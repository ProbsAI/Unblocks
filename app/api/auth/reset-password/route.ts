import { z } from 'zod'
import { after } from 'next/server'
import { requestPasswordReset } from '@unblocks/core/auth'
import { sendEmail, resetPasswordEmail } from '@unblocks/core/email'
import { validateBody, successResponse } from '@unblocks/core/api'
import { withErrorHandler } from '@/lib/routeHandler'

const resetRequestSchema = z.object({
  email: z.string().email(),
})

export const POST = withErrorHandler(async (request) => {
  const { email } = await validateBody(request, resetRequestSchema)

  const result = await requestPasswordReset(email)

  // Schedule email after the response to prevent timing-based account
  // enumeration (response latency is identical for existing vs non-existing
  // accounts). next/server `after()` ensures the work completes even in
  // serverless/edge runtimes where fire-and-forget promises may be killed.
  if (result) {
    const appUrl = process.env.APP_URL ?? 'http://localhost:3000'
    const resetUrl = `${appUrl}/reset-password/confirm?token=${result.token}`

    const { subject, html } = resetPasswordEmail({
      userName: email,
      resetUrl,
    })
    after(() => sendEmail({ to: email, subject, html }))
  }

  return successResponse({
    message: 'If an account exists, a password reset link has been sent',
  })
})
