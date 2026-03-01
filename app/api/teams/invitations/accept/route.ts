import { withErrorHandler } from '@/lib/routeHandler'
import { requireAuth } from '@/lib/serverAuth'
import { validateBody } from '@unblocks/core/api'
import { successResponse } from '@unblocks/core/api'
import { acceptInvitation } from '@unblocks/core/teams'
import { z } from 'zod'

const acceptSchema = z.object({
  token: z.string().min(1),
})

export const POST = withErrorHandler(async (request: Request) => {
  const user = await requireAuth()
  const body = await validateBody(request, acceptSchema)

  await acceptInvitation(body.token, user.id)

  return successResponse({ accepted: true })
})
