import { z } from 'zod'
import { createUser, checkRateLimit } from '@unblocks/core/auth'
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

  // Same reasoning as the magic-link route. Registration is public, creates a
  // row, and runs bcrypt — which blocks the event loop — so unbounded signups
  // can monopolise it. (It also ran ~260ms of PBKDF2 for a column nothing read;
  // that is gone, bcrypt is not.)
  //
  // Process-local counters, so per instance and reset on deploy: a speed bump,
  // not a control. A real one needs the shared store.
  await checkRateLimit(`register:${getClientIp(request) ?? 'unknown'}`, {
    windowMs: 15 * 60 * 1000,
    maxAttempts: 10,
  })

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
