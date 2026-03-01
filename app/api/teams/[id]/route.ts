import { withErrorHandler } from '@/lib/routeHandler'
import { requireAuth } from '@/lib/serverAuth'
import { successResponse } from '@unblocks/core/api'
import { getTeam, getUserTeamRole } from '@unblocks/core/teams'
import { ForbiddenError } from '@unblocks/core/errors/types'

export const GET = withErrorHandler(
  async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const user = await requireAuth()
    const { id } = await params

    const role = await getUserTeamRole(id, user.id)
    if (!role) {
      throw new ForbiddenError('Not a member of this team')
    }

    const team = await getTeam(id)

    return successResponse(team)
  }
)
