import { withErrorHandler } from '@/lib/routeHandler'
import { requireAuth } from '@/lib/serverAuth'
import { validateBody } from '@unblocks/core/api'
import { successResponse } from '@unblocks/core/api'
import { createApiKey, listApiKeys, CreateApiKeySchema } from '@unblocks/core/api-keys'
import { checkRateLimit } from '@unblocks/core/auth'

export const POST = withErrorHandler(async (request: Request) => {
  const user = await requireAuth()

  // Per-plan key caps are configured in billing.config but not yet enforced, so
  // nothing else bounds how many keys one account can mint. This caps the rate
  // rather than the total; the plan limit is the real fix and is still open.
  await checkRateLimit(`api-keys:create:${user.id}`, {
    windowMs: 60 * 60 * 1000,
    maxAttempts: 20,
  })

  const body = await validateBody(request, CreateApiKeySchema)

  const result = await createApiKey(user.id, body)

  return successResponse(result, undefined, 201)
})

export const GET = withErrorHandler(async () => {
  const user = await requireAuth()

  const keys = await listApiKeys(user.id)

  return successResponse(keys)
})
