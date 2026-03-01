import { verifyMagicLink, createSession } from '@unblocks/core/auth'
import {
  SESSION_COOKIE_NAME,
  getSessionCookieOptions,
  serializeCookie,
} from '@unblocks/core/security/cookies'
import { withErrorHandler, getClientIp, getUserAgent } from '@/lib/routeHandler'

export const GET = withErrorHandler(async (request) => {
  const url = new URL(request.url)
  const token = url.searchParams.get('token')

  if (!token) {
    return new Response(null, {
      status: 302,
      headers: { Location: '/login?error=invalid_token' },
    })
  }

  try {
    const user = await verifyMagicLink(token)

    const session = await createSession(user.id, {
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
    })

    const cookie = serializeCookie(
      SESSION_COOKIE_NAME,
      session.token,
      getSessionCookieOptions()
    )

    return new Response(null, {
      status: 302,
      headers: {
        Location: '/dashboard',
        'Set-Cookie': cookie,
      },
    })
  } catch {
    return new Response(null, {
      status: 302,
      headers: { Location: '/login?error=invalid_token' },
    })
  }
})
