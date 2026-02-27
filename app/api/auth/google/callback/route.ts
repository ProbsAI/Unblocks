import {
  exchangeGoogleCode,
  getGoogleUserInfo,
  handleOAuthCallback,
  createSession,
} from '@unblocks/core/auth'
import {
  SESSION_COOKIE_NAME,
  getSessionCookieOptions,
  serializeCookie,
  clearCookie,
} from '@unblocks/core/security/cookies'
import { withErrorHandler, getClientIp, getUserAgent } from '@/lib/routeHandler'
import { cookies } from 'next/headers'

const OAUTH_STATE_COOKIE = '__unblocks_oauth_state'

export const GET = withErrorHandler(async (request) => {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const error = url.searchParams.get('error')

  if (error || !code) {
    return new Response(null, { status: 302, headers: { Location: '/login?error=oauth_failed' } })
  }

  // Validate OAuth state to prevent CSRF
  const stateParam = url.searchParams.get('state')
  const cookieStore = await cookies()
  const storedState = cookieStore.get(OAUTH_STATE_COOKIE)?.value

  if (!stateParam || !storedState || stateParam !== storedState) {
    return new Response(null, { status: 302, headers: { Location: '/login?error=oauth_state_mismatch' } })
  }

  const clientId = process.env.GOOGLE_CLIENT_ID ?? ''
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? ''
  const appUrl = process.env.APP_URL ?? 'http://localhost:3000'
  const redirectUri = `${appUrl}/api/auth/google/callback`

  const tokens = await exchangeGoogleCode(code, clientId, clientSecret, redirectUri)
  const userInfo = await getGoogleUserInfo(tokens.accessToken)

  const user = await handleOAuthCallback(
    'google',
    userInfo.sub,
    tokens.accessToken,
    tokens.refreshToken,
    {
      email: userInfo.email,
      name: userInfo.name,
      avatarUrl: userInfo.picture,
    }
  )

  const session = await createSession(user.id, {
    ipAddress: getClientIp(request),
    userAgent: getUserAgent(request),
  })

  const sessionCookie = serializeCookie(
    SESSION_COOKIE_NAME,
    session.token,
    getSessionCookieOptions()
  )

  // Clear the oauth state cookie and set the session cookie
  const clearStateCookie = clearCookie(OAUTH_STATE_COOKIE)

  const response = new Response(null, {
    status: 302,
    headers: { Location: '/dashboard' },
  })
  response.headers.append('Set-Cookie', sessionCookie)
  response.headers.append('Set-Cookie', clearStateCookie)

  return response
})
