import { withErrorHandler } from '@/lib/routeHandler'
import { requireAuth } from '@/lib/serverAuth'
import { validateBody } from '@unblocks/core/api'
import { successResponse } from '@unblocks/core/api'
import { complete } from '@/blocks/ai-wrapper'
import { z } from 'zod'

const completionSchema = z.object({
  model: z.string().optional(),
  messages: z.array(z.object({
    role: z.enum(['system', 'user', 'assistant']),
    content: z.string(),
  })),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().min(1).optional(),
})

export const POST = withErrorHandler(async (request: Request) => {
  const user = await requireAuth()
  const body = await validateBody(request, completionSchema)

  const response = await complete({
    model: body.model ?? 'gpt-4o',
    messages: body.messages,
    temperature: body.temperature,
    maxTokens: body.maxTokens,
    userId: user.id,
  })

  return successResponse(response)
})
