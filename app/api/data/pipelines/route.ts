import { withErrorHandler } from '@/lib/routeHandler'
import { requireAuth } from '@/lib/serverAuth'
import { validateBody } from '@unblocks/core/api'
import { successResponse, errorResponse } from '@unblocks/core/api'
import { tryRequireBlock } from '@unblocks/core/runtime/blockRegistry'
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

  const data = tryRequireBlock<{ createPipeline: Function }>('data-platform')
  if (!data) {
    return errorResponse('BLOCK_NOT_AVAILABLE', 'Data platform block is not installed', 404)
  }

  const pipeline = await data.createPipeline(user.id, body)
  return successResponse(pipeline, undefined, 201)
})

export const GET = withErrorHandler(async () => {
  const user = await requireAuth()

  const data = tryRequireBlock<{ listPipelines: Function }>('data-platform')
  if (!data) {
    return errorResponse('BLOCK_NOT_AVAILABLE', 'Data platform block is not installed', 404)
  }

  const userPipelines = await data.listPipelines(user.id)
  return successResponse(userPipelines)
})
