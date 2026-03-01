import { z } from 'zod'
import { verifyCredentials, createSession, checkRateLimit } from '@unblocks/core/auth'
import { validateBody, successResponse } from '@unblocks/core/api'
import {
  SESSION_COOKIE_NAME,
  getSessionCookieOptions,
  serializeCookie,
} from '@unblocks/core/security/cookies'
import { withErrorHandler, getClientIp, getUserAgent } from '@/lib/routeHandler'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export const POST = withErrorHandler(async (request) => {
  const input = await validateBody(request, loginSchema)
  const ip = getClientIp(request) ?? 'unknown'

  // Rate limit by IP + email
  await checkRateLimit(`login:${ip}:${input.email}`, {
    windowMs: 15 * 60 * 1000,
    maxAttempts: 5,
  })

  const user = await verifyCredentials(input.email, input.password)

  const session = await createSession(user.id, {
    ipAddress: ip,
    userAgent: getUserAgent(request),
  })

  const cookie = serializeCookie(
    SESSION_COOKIE_NAME,
    session.token,
    getSessionCookieOptions()
  )

  const response = successResponse({ user })
  response.headers.set('Set-Cookie', cookie)
  return response
})
