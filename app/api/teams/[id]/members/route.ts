import { withErrorHandler } from '@/lib/routeHandler'
import { requireAuth } from '@/lib/serverAuth'
import { validateBody } from '@unblocks/core/api'
import { successResponse } from '@unblocks/core/api'
import { getTeamMembers, getUserTeamRole, inviteMember } from '@unblocks/core/teams'
import { ForbiddenError } from '@unblocks/core/errors/types'
import { z } from 'zod'

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'member']).default('member'),
})

export const GET = withErrorHandler(
  async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const user = await requireAuth()
    const { id } = await params

    const role = await getUserTeamRole(id, user.id)
    if (!role) {
      throw new ForbiddenError('Not a member of this team')
    }

    const members = await getTeamMembers(id)

    return successResponse(members)
  }
)

export const POST = withErrorHandler(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const user = await requireAuth()
    const { id } = await params
    const body = await validateBody(request, inviteSchema)

    const invitation = await inviteMember(id, body.email, body.role, user.id)

    return successResponse(invitation, undefined, 201)
  }
)
