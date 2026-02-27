import { withErrorHandler } from '@/lib/routeHandler'
import { requireAuth } from '@/lib/serverAuth'
import { successResponse } from '@unblocks/core/api'
import { getNotifications, getUnreadCount, markAllAsRead } from '@unblocks/core/notifications'

export const GET = withErrorHandler(async (request: Request) => {
  const user = await requireAuth()
  const url = new URL(request.url)

  const limit = parseInt(url.searchParams.get('limit') ?? '50', 10)
  const offset = parseInt(url.searchParams.get('offset') ?? '0', 10)
  const unreadOnly = url.searchParams.get('unreadOnly') === 'true'

  const result = await getNotifications(user.id, { limit, offset, unreadOnly })
  const unreadCount = await getUnreadCount(user.id)

  return successResponse({
    ...result,
    unreadCount,
  })
})

export const POST = withErrorHandler(async (request: Request) => {
  const user = await requireAuth()
  const body = await request.json()

  if (body.action === 'markAllRead') {
    const count = await markAllAsRead(user.id)
    return successResponse({ marked: count })
  }

  return new Response(
    JSON.stringify({ error: { code: 'BAD_REQUEST', message: 'Unknown action' } }),
    { status: 400, headers: { 'Content-Type': 'application/json' } }
  )
})
