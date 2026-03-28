import { withErrorHandler } from '@/lib/routeHandler'
import { requireAuth } from '@/lib/serverAuth'
import { validateBody } from '@unblocks/core/api'
import { successResponse } from '@unblocks/core/api'
import { createApiKey, listApiKeys, CreateApiKeySchema } from '@unblocks/core/api-keys'

export const POST = withErrorHandler(async (request: Request) => {
  const user = await requireAuth()
  const body = await validateBody(request, CreateApiKeySchema)

  const result = await createApiKey(user.id, body)

  return successResponse(result, undefined, 201)
})

export const GET = withErrorHandler(async () => {
  const user = await requireAuth()

  const keys = await listApiKeys(user.id)

  return successResponse(keys)
})
