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
} from '@unblocks/core/security/cookies'
import { withErrorHandler, getClientIp, getUserAgent } from '@/lib/routeHandler'
import { redirect } from 'next/navigation'

export const GET = withErrorHandler(async (request) => {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const error = url.searchParams.get('error')

  if (error || !code) {
    return redirect('/login?error=oauth_failed')
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

  const cookie = serializeCookie(
    SESSION_COOKIE_NAME,
    session.token,
    getSessionCookieOptions()
  )

  const response = new Response(null, {
    status: 302,
    headers: {
      Location: '/dashboard',
      'Set-Cookie': cookie,
    },
  })

  return response
})
