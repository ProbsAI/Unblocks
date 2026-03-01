import { z } from 'zod'
import { resetPassword } from '@unblocks/core/auth'
import { validateBody, successResponse } from '@unblocks/core/api'
import { withErrorHandler } from '@/lib/routeHandler'

const resetConfirmSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export const POST = withErrorHandler(async (request) => {
  const { token, password } = await validateBody(request, resetConfirmSchema)

  await resetPassword(token, password)

  return successResponse({ message: 'Password has been reset successfully' })
})
