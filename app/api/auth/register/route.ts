import { z } from 'zod'
import { createUser } from '@unblocks/core/auth'
import { createSession } from '@unblocks/core/auth'
import { validateBody } from '@unblocks/core/api'
import { successResponse } from '@unblocks/core/api'
import {
  SESSION_COOKIE_NAME,
  getSessionCookieOptions,
  serializeCookie,
} from '@unblocks/core/security/cookies'
import { withErrorHandler, getClientIp, getUserAgent } from '@/lib/routeHandler'

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required').optional(),
})

export const POST = withErrorHandler(async (request) => {
  const input = await validateBody(request, registerSchema)

  const user = await createUser({
    email: input.email,
    password: input.password,
    name: input.name,
  })

  const session = await createSession(user.id, {
    ipAddress: getClientIp(request),
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
