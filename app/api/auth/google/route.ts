import { getGoogleAuthUrl } from '@unblocks/core/auth'
import { generateCsrfToken } from '@unblocks/core/security/csrf'
import { serializeCookie } from '@unblocks/core/security/cookies'
import { withErrorHandler } from '@/lib/routeHandler'

const OAUTH_STATE_COOKIE = '__unblocks_oauth_state'

export const GET = withErrorHandler(async () => {
  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) {
    return Response.json(
      { error: { code: 'OAUTH_NOT_CONFIGURED', message: 'Google OAuth is not configured' } },
      { status: 501 }
    )
  }

  const appUrl = process.env.APP_URL ?? 'http://localhost:3000'
  const redirectUri = `${appUrl}/api/auth/google/callback`
  const state = generateCsrfToken()

  const url = getGoogleAuthUrl(clientId, redirectUri, state)

  // Store state in a short-lived cookie for validation in the callback
  const isProduction = process.env.NODE_ENV === 'production'
  const stateCookie = serializeCookie(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: 600, // 10 minutes
  })

  return new Response(null, {
    status: 302,
    headers: {
      Location: url,
      'Set-Cookie': stateCookie,
    },
  })
})
