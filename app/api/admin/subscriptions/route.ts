import { withErrorHandler } from '@/lib/routeHandler'
import { requireAuth } from '@/lib/serverAuth'
import { successResponse } from '@unblocks/core/api'
import { requireAdmin, listSubscriptions } from '@unblocks/core/admin'

export const GET = withErrorHandler(async (request: Request) => {
  const user = await requireAuth()
  await requireAdmin(user.id)

  const url = new URL(request.url)
  const status = url.searchParams.get('status') ?? undefined
  const limit = parseInt(url.searchParams.get('limit') ?? '50', 10)
  const offset = parseInt(url.searchParams.get('offset') ?? '0', 10)

  const result = await listSubscriptions({ status, limit, offset })

  return successResponse(result)
})
