import { z } from 'zod'
import { after } from 'next/server'
import { createMagicLink } from '@unblocks/core/auth'
import { sendEmail, magicLinkEmail } from '@unblocks/core/email'
import { validateBody, successResponse } from '@unblocks/core/api'
import { withErrorHandler } from '@/lib/routeHandler'

const magicLinkSchema = z.object({
  email: z.string().email(),
})

export const POST = withErrorHandler(async (request) => {
  const { email } = await validateBody(request, magicLinkSchema)
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
