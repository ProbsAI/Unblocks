import { cookies } from 'next/headers'
import {
  peekMagicLink,
  verifyMagicLink,
  createSession,
  revokeSessionByToken,
} from '@unblocks/core/auth'
import {
  SESSION_COOKIE_NAME,
  getSessionCookieOptions,
  serializeCookie,
} from '@unblocks/core/security/cookies'
import { loadConfig } from '@unblocks/core/runtime/configLoader'
import { withErrorHandler, getClientIp, getUserAgent } from '@/lib/routeHandler'
import { getCurrentUser } from '@/lib/serverAuth'

/**
 * Magic link verification.
 *
 * ## Why this is a POST and not just the emailed GET
 *
 * A GET that creates a session is a login-CSRF: an attacker requests a magic
 * link for their OWN account, sends the victim that URL, and the victim's
 * browser signs them into the attacker's account. Nothing looks wrong — they
 * are logged in — so anything they do next (adding a card, uploading a
 * document, connecting an integration) lands in the attacker's account, where
 * the attacker can read it.
 *
 * The same-origin check in middleware.ts cannot help, because it keys off the
 * HTTP method and a GET is treated as safe. The fix is structural: the emailed
 * link lands on a confirmation page, and the session is created by a
 * same-origin POST from that page — which the CSRF gate does cover. A page
 * under the attacker's control cannot make the browser issue that POST.
 *
 * Set `providers.magicLink.requireConfirmation: false` in auth.config.ts to go
 * back to one-click sign-in, accepting the above. Even then the account-switch
 * guard below stays on.
 */

const CONFIRM_PATH = '/magic-link/confirm'

function confirmUrl(token: string): string {
  return `${CONFIRM_PATH}?token=${encodeURIComponent(token)}`
}

/**
 * 303 rather than 302 on the POST paths: it is the status that tells the
 * browser unambiguously to follow with a GET, so a reload of the landing page
 * cannot re-submit the form.
 */
function redirectTo(location: string, cookie?: string, status = 302): Response {
  const headers: Record<string, string> = { Location: location }
  if (cookie) headers['Set-Cookie'] = cookie
  return new Response(null, { status, headers })
}

/** Appends a marker so the landing page can say how the session was created. */
function landingUrl(): string {
  const { afterLogin } = loadConfig('auth').redirects
  const separator = afterLogin.includes('?') ? '&' : '?'
  return `${afterLogin}${separator}signed_in_via=magic_link`
}

/** Reads the interstitial's form post, and a JSON body for non-browser callers. */
async function readFields(request: Request): Promise<Record<string, string>> {
  const contentType = request.headers.get('content-type') ?? ''

  if (contentType.includes('application/json')) {
    const body = (await request.json().catch(() => null)) as unknown
    if (!body || typeof body !== 'object') return {}
    return Object.fromEntries(
      Object.entries(body as Record<string, unknown>).map(([key, value]) => [
        key,
        String(value),
      ])
    )
  }

  const form = await request.formData().catch(() => null)
  if (!form) return {}

  const fields: Record<string, string> = {}
  for (const [key, value] of form.entries()) {
    if (typeof value === 'string') fields[key] = value
  }
  return fields
}

async function establishSession(
  request: Request,
  token: string,
  replacing: string | null,
  status: number
): Promise<Response> {
  const user = await verifyMagicLink(token)

  // Drop the session being replaced rather than only overwriting its cookie.
  // The old token stays valid server-side otherwise, so a copy of it — in
  // another browser, or captured earlier — would still authenticate as the
  // previous account after the user believed they had switched away.
  if (replacing) {
    await revokeSessionByToken(replacing)
  }

  const session = await createSession(user.id, {
    ipAddress: getClientIp(request),
    userAgent: getUserAgent(request),
  })

  const cookie = serializeCookie(
    SESSION_COOKIE_NAME,
    session.token,
    getSessionCookieOptions()
  )

  return redirectTo(landingUrl(), cookie, status)
}

export const GET = withErrorHandler(async (request) => {
  const token = new URL(request.url).searchParams.get('token')

  if (!token) {
    return redirectTo('/login?error=invalid_token')
  }

  const { requireConfirmation } = loadConfig('auth').providers.magicLink

  if (requireConfirmation) {
    // Deliberately no session work here — not even a lookup. The page does the
    // peeking, and it does it after the browser has been sent somewhere it can
    // show the user what is about to happen.
    return redirectTo(confirmUrl(token))
  }

  // Confirmation is off, but an existing session still routes through the
  // interstitial: silently swapping which account someone is signed into is
  // the damaging half of the attack, and it is also just bad behaviour. This
  // does not distinguish same-account from different-account (that would need
  // a lookup to decide) — a same-account click simply costs one extra button.
  const signedIn = await getCurrentUser()
  if (signedIn) {
    return redirectTo(confirmUrl(token))
  }

  try {
    return await establishSession(request, token, null, 302)
  } catch {
    return redirectTo('/login?error=invalid_token')
  }
})

export const POST = withErrorHandler(async (request) => {
  const fields = await readFields(request)
  const token = fields.token

  if (!token) {
    return redirectTo('/login?error=invalid_token', undefined, 303)
  }

  // Evidence the request came from the interstitial rather than a hand-built
  // form. middleware.ts already rejects a cross-site POST; this is the second
  // lock, and it keeps the endpoint honest if that check is ever relaxed.
  if (fields.confirm !== '1') {
    return redirectTo(confirmUrl(token), undefined, 303)
  }

  const target = await peekMagicLink(token)
  if (!target) {
    return redirectTo('/login?error=invalid_token', undefined, 303)
  }

  const signedIn = await getCurrentUser()
  const isSwitch = signedIn !== null && signedIn.email !== target.email

  // Ordering matters: this runs BEFORE verifyMagicLink, which marks the token
  // used. Refusing here leaves the link working, so someone who declines a
  // switch can still use it after signing out. Refusing afterwards would burn
  // it and strand them.
  if (isSwitch && fields.switch_account !== '1') {
    return redirectTo(confirmUrl(token), undefined, 303)
  }

  const cookieStore = await cookies()
  const currentToken = cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null

  try {
    return await establishSession(
      request,
      token,
      isSwitch ? currentToken : null,
      303
    )
  } catch {
    return redirectTo('/login?error=invalid_token', undefined, 303)
  }
})
