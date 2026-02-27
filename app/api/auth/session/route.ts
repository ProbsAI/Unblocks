import { getCurrentUser } from '@/lib/serverAuth'
import { successResponse, errorResponse } from '@unblocks/core/api'
import { withErrorHandler } from '@/lib/routeHandler'

export const GET = withErrorHandler(async () => {
  const user = await getCurrentUser()

  if (!user) {
    return errorResponse('NOT_AUTHENTICATED', 'Not authenticated', 401)
  }

  return successResponse({ user })
})
