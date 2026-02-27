import { withErrorHandler } from '@/lib/routeHandler'
import { requireAuth } from '@/lib/serverAuth'
import { validateBody } from '@unblocks/core/api'
import { successResponse } from '@unblocks/core/api'
import { removeMember, updateMemberRole } from '@unblocks/core/teams'
import { z } from 'zod'

const updateRoleSchema = z.object({
  role: z.enum(['admin', 'member']),
})

export const PATCH = withErrorHandler(
  async (
    request: Request,
    { params }: { params: Promise<{ id: string; userId: string }> }
  ) => {
    const user = await requireAuth()
    const { id, userId } = await params
    const body = await validateBody(request, updateRoleSchema)

    await updateMemberRole(id, userId, body.role, user.id)

    return successResponse({ updated: true })
  }
)

export const DELETE = withErrorHandler(
  async (
    _request: Request,
    { params }: { params: Promise<{ id: string; userId: string }> }
  ) => {
    const user = await requireAuth()
    const { id, userId } = await params

    await removeMember(id, userId, user.id)

    return successResponse({ removed: true })
  }
)
