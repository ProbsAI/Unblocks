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

  // Unauthenticated, and it both creates a user row and sends mail for any
  // address it has not seen. Without a limiter, anyone can do both at will with
  // a fresh address each time.
  //
  // (This used to also burn ~260ms of synchronous PBKDF2 per new address, for
  // an email_hash column nothing ever queried. That derivation is gone; the
  // limit stays for the row and the mail.)
  //
  // Limited by IP first, since varying the address is what makes the abuse
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
