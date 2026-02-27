import { withErrorHandler } from '@/lib/routeHandler'
import { requireAuth } from '@/lib/serverAuth'
import { validateBody } from '@unblocks/core/api'
import { successResponse } from '@unblocks/core/api'
import { createDataset, listDatasets } from '@/blocks/data-platform'
import { z } from 'zod'

const createSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  sourceId: z.string().uuid().optional(),
  pipelineId: z.string().uuid().optional(),
  teamId: z.string().uuid().optional(),
  schema: z.record(z.string()).optional(),
})

export const POST = withErrorHandler(async (request: Request) => {
  const user = await requireAuth()
  const body = await validateBody(request, createSchema)

  const dataset = await createDataset(user.id, body)

  return successResponse(dataset, undefined, 201)
})

export const GET = withErrorHandler(async () => {
  const user = await requireAuth()
  const userDatasets = await listDatasets(user.id)
  return successResponse(userDatasets)
})
