import { withErrorHandler } from '@/lib/routeHandler'
import { requireAuth } from '@/lib/serverAuth'
import { successResponse } from '@unblocks/core/api'
import { getFile, deleteFile } from '@unblocks/core/uploads'

export const GET = withErrorHandler(
  async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const user = await requireAuth()
    const { id } = await params

    const file = await getFile(id, user.id)

    return successResponse(file)
  }
)

export const DELETE = withErrorHandler(
  async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const user = await requireAuth()
    const { id } = await params

    await deleteFile(id, user.id)

    return successResponse({ deleted: true })
  }
)
