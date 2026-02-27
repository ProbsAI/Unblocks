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

  // In production, send email with magic link
  // For now, return the token (will be wired to email system in Phase 5)
  const appUrl = process.env.APP_URL ?? 'http://localhost:3000'
  const _magicLinkUrl = `${appUrl}/api/auth/magic-link/verify?token=${token}`

  // Always return success to prevent email enumeration
  return successResponse({
    message: 'If an account exists, a magic link has been sent to your email',
  })
})
