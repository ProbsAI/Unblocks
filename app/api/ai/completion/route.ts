import { withErrorHandler } from '@/lib/routeHandler'
import { requireAuth } from '@/lib/serverAuth'
import { validateBody } from '@unblocks/core/api'
import { successResponse, errorResponse } from '@unblocks/core/api'
import { tryRequireBlock } from '@unblocks/core/runtime/blockRegistry'
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

  const ai = tryRequireBlock<{ complete: Function }>('ai-wrapper')
  if (!ai) {
    return errorResponse('BLOCK_NOT_AVAILABLE', 'AI wrapper block is not installed', 404)
  }

  const response = await ai.complete({
    model: body.model ?? 'gpt-4o',
    messages: body.messages,
    temperature: body.temperature,
    maxTokens: body.maxTokens,
    userId: user.id,
  })

  return successResponse(response)
})
