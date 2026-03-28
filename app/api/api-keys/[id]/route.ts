import { withErrorHandler } from '@/lib/routeHandler'
import { requireAuth } from '@/lib/serverAuth'
import { successResponse } from '@unblocks/core/api'
import { revokeApiKey } from '@unblocks/core/api-keys'

export const DELETE = withErrorHandler(async (request: Request, context) => {
  const user = await requireAuth()
  const { id } = await context!.params

  await revokeApiKey(id, user.id)

  return successResponse({ revoked: true })
})
