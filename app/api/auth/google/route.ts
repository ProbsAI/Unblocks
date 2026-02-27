import { getGoogleAuthUrl } from '@unblocks/core/auth'
import { generateCsrfToken } from '@unblocks/core/security/csrf'
import { withErrorHandler } from '@/lib/routeHandler'

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

  return Response.redirect(url)
})
