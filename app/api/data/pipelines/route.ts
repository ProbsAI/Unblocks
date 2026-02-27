import { withErrorHandler } from '@/lib/routeHandler'
import { requireAuth } from '@/lib/serverAuth'
import { validateBody } from '@unblocks/core/api'
import { successResponse } from '@unblocks/core/api'
import { createPipeline, listPipelines } from '@/blocks/data-platform'
import { z } from 'zod'

const createSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  steps: z.array(z.object({
    id: z.string(),
    type: z.enum(['fetch', 'transform', 'filter', 'output']),
    name: z.string(),
    config: z.record(z.unknown()),
    order: z.number(),
  })),
  schedule: z.string().optional(),
  teamId: z.string().uuid().optional(),
})

export const POST = withErrorHandler(async (request: Request) => {
  const user = await requireAuth()
  const body = await validateBody(request, createSchema)

  const pipeline = await createPipeline(user.id, body)

  return successResponse(pipeline, undefined, 201)
})

export const GET = withErrorHandler(async () => {
  const user = await requireAuth()
  const userPipelines = await listPipelines(user.id)
  return successResponse(userPipelines)
})
