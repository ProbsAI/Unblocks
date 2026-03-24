import { z } from 'zod'
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
  const loginUrl = `${appUrl}/api/auth/magic-link/verify?token=${token}`

  const { subject, html } = magicLinkEmail({ loginUrl })
  await sendEmail({ to: email, subject, html })

  // Always return success to prevent email enumeration
  return successResponse({
    message: 'If an account exists, a magic link has been sent to your email',
  })
})
