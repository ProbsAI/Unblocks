import { z } from 'zod'
import { after } from 'next/server'
import { createMagicLink, checkRateLimit } from '@unblocks/core/auth'
import { sendEmail, magicLinkEmail } from '@unblocks/core/email'
import { validateBody, successResponse } from '@unblocks/core/api'
import { withErrorHandler, getClientIp } from '@/lib/routeHandler'

const magicLinkSchema = z.object({
  email: z.string().email(),
})

export const POST = withErrorHandler(async (request) => {
  const { email } = await validateBody(request, magicLinkSchema)
  const ip = getClientIp(request) ?? 'unknown'

  // Unauthenticated, and expensive on both axes: an unseen address makes
  // createMagicLink insert a user and derive slowBlindIndex, which is ~260ms of
  // *synchronous* PBKDF2 — enough that a handful of requests a second pegs the
  // event loop. It also sends mail. Without a limiter, anyone can do both, with
  // a fresh random address each time to guarantee the expensive branch.
  //
  // Limited by IP first, since varying the address is what makes the attack
  // work, then by address so one mailbox cannot be flooded from many IPs.
  //
  // Scope, stated plainly: checkRateLimit keeps counters in a process-local
  // Map, so the ceiling is per instance and resets on deploy. That is a speed
  // bump, not a control. A real one needs the shared store (Redis is already
  // an optional dependency).
  await checkRateLimit(`magic-link:ip:${ip}`, {
    windowMs: 15 * 60 * 1000,
    maxAttempts: 10,
  })
  await checkRateLimit(`magic-link:email:${email.toLowerCase()}`, {
    windowMs: 15 * 60 * 1000,
    maxAttempts: 5,
  })

  const token = await createMagicLink(email)

  const appUrl = process.env.APP_URL ?? 'http://localhost:3000'
  const loginUrl = `${appUrl}/api/auth/magic-link/verify?token=${encodeURIComponent(token)}`

  // Schedule email after the response to equalize response timing and prevent
  // email enumeration via latency differences. after() ensures reliable
  // delivery in serverless/edge runtimes.
  const { subject, html } = magicLinkEmail({ loginUrl })
  after(() => {
    return sendEmail({ to: email, subject, html }).catch((error) => {
      console.error('Failed to send magic link email', { email, error })
    })
  })

  return successResponse({
    message: 'If an account exists, a magic link has been sent to your email',
  })
})
