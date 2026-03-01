import { withErrorHandler } from '@/lib/routeHandler'
import { requireAuth } from '@/lib/serverAuth'
import { validateBody } from '@unblocks/core/api'
import { successResponse } from '@unblocks/core/api'
import { createTeam, getUserTeams } from '@unblocks/core/teams'
import { z } from 'zod'

const createTeamSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
})

export const POST = withErrorHandler(async (request: Request) => {
  const user = await requireAuth()
  const body = await validateBody(request, createTeamSchema)

  const team = await createTeam(user.id, user.email, body.name, body.slug)

  return successResponse(team, undefined, 201)
})

export const GET = withErrorHandler(async () => {
  const user = await requireAuth()

  const userTeams = await getUserTeams(user.id)

  return successResponse(userTeams)
})
