import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { SESSION_COOKIE_NAME } from '@unblocks/core/security/cookies'
import { jwtVerify } from 'jose'
// Imported rather than redeclared: middleware and validateApiKey must agree on
// what counts as an API key, and a local copy would let them drift apart on a
// security boundary.
import { API_KEY_PREFIX } from '@unblocks/core/api-keys/types'


/**
 * Internal header carrying a middleware-validated API key to the route handler.
 * Never accepted from the client — see the strip in middleware() below.
 */
const INTERNAL_API_KEY_HEADER = 'x-api-key'

function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET
  if (!secret) return new TextEncoder().encode('')
  return new TextEncoder().encode(secret)
}

const PUBLIC_PATHS = [
  '/',
  '/login',
  '/signup',
  '/reset-password',
  // The magic-link interstitial. Public by necessity — the person landing here
  // is, in the ordinary case, not signed in yet.
  '/magic-link/confirm',
  '/pricing',
  '/api/auth/register',
  '/api/auth/login',
  '/api/auth/google',
  '/api/auth/google/callback',
  '/api/auth/magic-link',
  '/api/auth/magic-link/verify',
  '/api/auth/reset-password',
  '/api/auth/reset-password/confirm',
  '/api/auth/verify-email',
  '/api/auth/session',
  '/api/health',
  '/api/billing/webhook',
]

const PUBLIC_PREFIXES = [
  '/_next',
  '/favicon',
  '/og-image',
]

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true
  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return true
  if (pathname.match(/\.(ico|png|jpg|jpeg|gif|svg|css|js|woff|woff2)$/)) return true
  return false
}

/**
 * Extract a Bearer token from the Authorization header.
 */
function getBearerToken(request: NextRequest): string | null {
  const auth = request.headers.get('authorization')
  // RFC 7235: the scheme token is case-insensitive, so `bearer ...` is valid.
  if (!auth || !/^bearer /i.test(auth)) return null
  return auth.slice(7)
}

// This keys off the method, so a state-changing GET is not covered — the check
// cannot protect one, and no route may rely on it to.
//
// /api/auth/magic-link/verify was the case that mattered: a public GET that
// created a session, and therefore a login-CSRF target. It now redirects to an
// interstitial and creates the session from a same-origin POST, which this
// check does cover. /api/auth/verify-email remains a state-changing public GET
// at much lower severity (it flips a verification flag, it does not
// authenticate). Anything new in that shape needs the same treatment rather
// than an entry here. See CLAUDE.md.
const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/**
 * Endpoints authenticated by request signature rather than by an ambient
 * cookie. They are invoked server-to-server, legitimately carry no Origin, and
 * are not CSRF-able because no browser credential is involved.
 */
const CSRF_EXEMPT_PATHS = ['/api/billing/webhook']

/**
 * Decide whether a state-changing request must be rejected as cross-site.
 *
 * This replaces the unused double-submit token module: it needs no cooperation
 * from client code, so it cannot be silently skipped by a form that forgot to
 * attach a header — which is how the previous CSRF implementation ended up
 * providing no protection at all.
 *
 * CSRF is only possible with an *ambient* credential the browser attaches by
 * itself, so the rule is:
 *
 *  - Bearer API key present -> never blocked. The token is not ambient; an
 *    attacker's page cannot make a browser send it. Blocking here would break
 *    every server-to-server call.
 *  - Origin present -> it must match. Browsers always send Origin on
 *    cross-origin state-changing requests, so this is what stops the attack.
 *  - Origin absent -> only blocked when a session cookie is present. That keeps
 *    non-browser clients (curl, mobile) working while still failing closed
 *    whenever there is actually a cookie to hijack.
 */
function isCrossSiteRequest(request: NextRequest): boolean {
  const hasSessionCookie = Boolean(
    request.cookies.get(SESSION_COOKIE_NAME)?.value
  )

  // Exempt Bearer API key requests ONLY when no session cookie rides along.
  //
  // getCurrentUser gives the session cookie priority over the API key, so a
  // request carrying both would be exempted here on the strength of the token
  // and then authenticated as the ambient session — the CSRF decision and the
  // authentication decision disagreeing about which credential matters. The
  // header is not attacker-settable cross-origin without permissive CORS (none
  // is configured), so this is hardening rather than a live hole, but the two
  // decisions must key off the same credential.
  const bearer = getBearerToken(request)
  if (!hasSessionCookie && bearer?.startsWith(API_KEY_PREFIX)) return false

  const source =
    request.headers.get('origin') ?? request.headers.get('referer')

  if (!source) {
    return hasSessionCookie
  }

  // Prefer the configured public origin: behind a proxy or load balancer,
  // nextUrl.origin can be the internal address rather than the browser's.
  const expected = process.env.APP_URL ?? request.nextUrl.origin

  try {
    return new URL(source).origin !== new URL(expected).origin
  } catch {
    return true
  }
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl

  // x-api-key is an INTERNAL header: serverAuth trusts it as proof that this
  // middleware validated a Bearer token. A client must never be able to set it
  // directly, so strip any inbound copy before anything else can observe it.
  // This runs ahead of the public-path check because public routes reach
  // getCurrentUser() too.
  const sanitized = new Headers(request.headers)
  sanitized.delete(INTERNAL_API_KEY_HEADER)

  // Always forward the sanitized headers rather than only when a forged value
  // was seen. A conditional here would mean the strip's effect depends on a
  // branch, and every return path below would have to remember to take it.
  const passThrough = (): NextResponse =>
    NextResponse.next({ request: { headers: sanitized } })

  // --- CSRF: same-origin enforcement on state-changing requests ---
  // Runs before the public-path check because unauthenticated POST endpoints
  // (login, register, password reset) are themselves CSRF targets.
  if (
    STATE_CHANGING_METHODS.has(request.method) &&
    !CSRF_EXEMPT_PATHS.includes(pathname) &&
    isCrossSiteRequest(request)
  ) {
    return NextResponse.json(
      {
        error: {
          code: 'CSRF_ERROR',
          message: 'Cross-origin request rejected',
        },
      },
      { status: 403 }
    )
  }

  // --- API Key auth for API routes ---
  // If the request has a Bearer token that looks like an API key,
  // pass it through to the route handler for full validation.
  // Middleware cannot do DB lookups (edge runtime), so we forward
  // the key via a header and let serverAuth.ts validate it.
  //
  // This runs BEFORE the public-path check, and must. Public routes call
  // getCurrentUser() too — /api/auth/session is the obvious one — so returning
  // early for them meant the key was stripped and never re-set, and Bearer auth
  // returned 401 there no matter how valid the key was.
  if (pathname.startsWith('/api/')) {
    const bearerToken = getBearerToken(request)
    if (bearerToken?.startsWith(API_KEY_PREFIX)) {
      // Set on the sanitized copy so a forged inbound value cannot survive.
      sanitized.set(INTERNAL_API_KEY_HEADER, bearerToken)
      return NextResponse.next({ request: { headers: sanitized } })
    }
  }

  // Allow public paths
  if (isPublicPath(pathname)) {
    return passThrough()
  }

  // --- Session cookie auth ---
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value

  if (!sessionToken) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: { code: 'AUTH_ERROR', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Verify JWT signature/expiry (full session validation happens in requireAuth)
  try {
    await jwtVerify(sessionToken, getSecret())
  } catch {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: { code: 'AUTH_ERROR', message: 'Invalid or expired session' } },
        { status: 401 }
      )
    }

    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return passThrough()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
