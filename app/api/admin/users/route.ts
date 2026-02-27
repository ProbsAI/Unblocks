import { withErrorHandler } from '@/lib/routeHandler'
import { requireAuth } from '@/lib/serverAuth'
import { successResponse } from '@unblocks/core/api'
import { requireAdmin, listUsers } from '@unblocks/core/admin'

export const GET = withErrorHandler(async (request: Request) => {
  const user = await requireAuth()
  await requireAdmin(user.id)

  const url = new URL(request.url)
  const search = url.searchParams.get('search') ?? undefined
  const limit = parseInt(url.searchParams.get('limit') ?? '50', 10)
  const offset = parseInt(url.searchParams.get('offset') ?? '0', 10)

  const result = await listUsers({ search, limit, offset })

  return successResponse(result)
})
