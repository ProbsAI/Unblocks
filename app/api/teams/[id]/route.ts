import { withErrorHandler } from '@/lib/routeHandler'
import { requireAuth } from '@/lib/serverAuth'
import { successResponse } from '@unblocks/core/api'
import { getTeam } from '@unblocks/core/teams'

export const GET = withErrorHandler(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    await requireAuth()
    const { id } = await params

    const team = await getTeam(id)

    return successResponse(team)
  }
)
