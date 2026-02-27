import { withErrorHandler } from '@/lib/routeHandler'
import { requireAuth } from '@/lib/serverAuth'
import { successResponse } from '@unblocks/core/api'
import { markAsRead } from '@unblocks/core/notifications'

export const POST = withErrorHandler(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const user = await requireAuth()
    const { id } = await params

    const success = await markAsRead(id, user.id)

    return successResponse({ read: success })
  }
)
