import { withErrorHandler } from '@/lib/routeHandler'
import { requireAuth } from '@/lib/serverAuth'
import { successResponse } from '@unblocks/core/api'
import { requireAdmin, getMetrics } from '@unblocks/core/admin'

export const GET = withErrorHandler(async () => {
  const user = await requireAuth()
  await requireAdmin(user.id)

  const metrics = await getMetrics()

  return successResponse(metrics)
})
