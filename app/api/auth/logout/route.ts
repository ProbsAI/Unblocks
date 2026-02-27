import { cookies } from 'next/headers'
import { revokeSessionByToken } from '@unblocks/core/auth'
import { SESSION_COOKIE_NAME, clearCookie } from '@unblocks/core/security/cookies'
import { withErrorHandler } from '@/lib/routeHandler'

export const POST = withErrorHandler(async () => {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)

  if (sessionCookie?.value) {
    await revokeSessionByToken(sessionCookie.value)
  }

  const response = Response.json({ data: { success: true } }, { status: 200 })
  response.headers.set('Set-Cookie', clearCookie(SESSION_COOKIE_NAME))
  return response
})
