import { z } from 'zod'
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

  if (result) {
    const appUrl = process.env.APP_URL ?? 'http://localhost:3000'
    const resetUrl = `${appUrl}/reset-password/confirm?token=${result.token}`

    const { subject, html } = resetPasswordEmail({
      userName: email,
      resetUrl,
    })
    await sendEmail({ to: email, subject, html })
  }

  // Always return success to prevent email enumeration
  return successResponse({
    message: 'If an account exists, a password reset link has been sent',
  })
})
