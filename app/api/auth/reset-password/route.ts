import { z } from 'zod'
import { requestPasswordReset } from '@unblocks/core/auth'
import { validateBody, successResponse } from '@unblocks/core/api'
import { withErrorHandler } from '@/lib/routeHandler'

const resetRequestSchema = z.object({
  email: z.string().email(),
})

export const POST = withErrorHandler(async (request) => {
  const { email } = await validateBody(request, resetRequestSchema)

  // Returns null if user doesn't exist — we don't reveal this
  const _result = await requestPasswordReset(email)

  // TODO: Wire to email system in Phase 5
  // If result is non-null, send reset email with result.token

  // Always return success to prevent email enumeration
  return successResponse({
    message: 'If an account exists, a password reset link has been sent',
  })
})
