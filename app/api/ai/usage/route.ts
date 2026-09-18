import { withErrorHandler } from '@/lib/routeHandler'
import { requireAuth } from '@/lib/serverAuth'
import { successResponse } from '@unblocks/core/api'
import { getUserUsage, getUsageHistory } from '@unblocks/core/ai'

export const GET = withErrorHandler(async (request: Request) => {
  const user = await requireAuth()

  const url = new URL(request.url)
  const period = url.searchParams.get('period') ?? 'month'

  const since = period === 'day'
    ? new Date(Date.now() - 24 * 60 * 60 * 1000)
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const stats = await getUserUsage(user.id, since)
  const history = await getUsageHistory(user.id, 20)

  return successResponse({ stats, history })
})
