import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { SESSION_COOKIE_NAME } from '@unblocks/core/security/cookies'
import { jwtVerify } from 'jose'

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

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl

  // Allow public paths
  if (isPublicPath(pathname)) {
    return NextResponse.next()
  }

  // Check for session cookie
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value

  if (!sessionToken) {
    // Return 401 JSON for API routes instead of redirecting
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

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
