import { withErrorHandler } from '@/lib/routeHandler'
import { requireAuth } from '@/lib/serverAuth'
import { successResponse, errorResponse } from '@unblocks/core/api'
import { tryRequireBlock } from '@unblocks/core/runtime/blockRegistry'

export const GET = withErrorHandler(async (request: Request) => {
  const user = await requireAuth()

  const ai = tryRequireBlock<{ getUserUsage: Function; getUsageHistory: Function }>('ai-wrapper')
  if (!ai) {
    return errorResponse('BLOCK_NOT_AVAILABLE', 'AI wrapper block is not installed', 404)
  }

  const url = new URL(request.url)
  const period = url.searchParams.get('period') ?? 'month'

  const since = period === 'day'
    ? new Date(Date.now() - 24 * 60 * 60 * 1000)
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const stats = await ai.getUserUsage(user.id, since)
  const history = await ai.getUsageHistory(user.id, 20)

  return successResponse({ stats, history })
})
