import { z } from 'zod'
import { createMagicLink } from '@unblocks/core/auth'
import { validateBody, successResponse } from '@unblocks/core/api'
import { withErrorHandler } from '@/lib/routeHandler'

const magicLinkSchema = z.object({
  email: z.string().email(),
})

export const POST = withErrorHandler(async (request) => {
  const { email } = await validateBody(request, magicLinkSchema)
  const token = await createMagicLink(email)

  // TODO: Wire to email system — send magic link to user
  // const appUrl = process.env.APP_URL ?? 'http://localhost:3000'
  // const magicLinkUrl = `${appUrl}/api/auth/magic-link/verify?token=${token}`

  // Always return success to prevent email enumeration
  return successResponse({
    message: 'If an account exists, a magic link has been sent to your email',
  })
})
