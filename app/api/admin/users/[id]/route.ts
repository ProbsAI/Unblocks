import { withErrorHandler } from '@/lib/routeHandler'
import { requireAuth } from '@/lib/serverAuth'
import { validateBody } from '@unblocks/core/api'
import { successResponse } from '@unblocks/core/api'
import { requireAdmin, updateUserStatus, setUserAdmin } from '@unblocks/core/admin'
import { z } from 'zod'

const updateSchema = z.object({
  status: z.enum(['active', 'suspended', 'banned']).optional(),
  isAdmin: z.boolean().optional(),
})

export const PATCH = withErrorHandler(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const user = await requireAuth()
    await requireAdmin(user.id)
    const { id } = await params
    const body = await validateBody(request, updateSchema)

    if (body.status) {
      await updateUserStatus(id, body.status)
    }

    if (body.isAdmin !== undefined) {
      await setUserAdmin(id, body.isAdmin)
    }

    return successResponse({ updated: true })
  }
)
