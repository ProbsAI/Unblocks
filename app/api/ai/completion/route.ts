import { withErrorHandler } from '@/lib/routeHandler'
import { requireAuth } from '@/lib/serverAuth'
import { validateBody } from '@unblocks/core/api'
import { successResponse } from '@unblocks/core/api'
import { complete } from '@unblocks/core/ai'
import { checkRateLimit } from '@unblocks/core/auth'
import { z } from 'zod'

/** Bound the request so a single call cannot run up an unbounded provider bill. */
const MAX_MESSAGES = 50
const MAX_CONTENT_CHARS = 24_000

const completionSchema = z.object({
  model: z.string().optional(),
  messages: z
    .array(
      z.object({
        role: z.enum(['system', 'user', 'assistant']),
        content: z.string().max(MAX_CONTENT_CHARS),
      })
    )
    .min(1)
    .max(MAX_MESSAGES),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().min(1).optional(),
})

export const POST = withErrorHandler(async (request: Request) => {
  const user = await requireAuth()

  // This endpoint calls a paid third-party provider, so an authenticated caller
  // could otherwise run up arbitrary cost. maxTokens bounds only the response;
  // the request itself is bounded by the schema above, and the call rate here.
  //
  // Scope, stated plainly: checkRateLimit keeps its counters in a process-local
  // Map, so the ceiling is per instance. Across N replicas or serverless
  // workers the effective limit is N x maxAttempts, and it resets on deploy.
  // That makes this a guard against runaway loops and casual abuse, NOT a
  // billing control. A real spend cap needs the shared store (Redis is already
  // an optional dependency) plus the dailyTokenLimit/monthlyTokenLimit checks
  // that ai.config declares and nothing enforces.
  await checkRateLimit(`ai:completion:${user.id}`, {
    windowMs: 60 * 1000,
    maxAttempts: 20,
  })

  const body = await validateBody(request, completionSchema)

  const response = await complete({
    // Omit rather than hardcoding a default here: complete() applies the
    // configured defaultModel, which a literal 'gpt-4o' silently overrode.
    model: body.model,
    messages: body.messages,
    temperature: body.temperature,
    maxTokens: body.maxTokens,
    userId: user.id,
  })

  return successResponse(response)
})
