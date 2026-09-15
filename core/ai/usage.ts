import { eq, and, gte, desc, sql } from 'drizzle-orm'
import { getDb } from '../db/client'
import { aiUsage } from './schema'
import aiConfig from './ai.config'
import { AIWrapperConfigSchema } from './types'
import type { UsageRecord, AIProvider } from './types'

interface TrackUsageInput {
  userId: string
  model: string
  provider: AIProvider
  promptTokens: number
  completionTokens: number
  totalTokens: number
  latencyMs: number
  metadata: Record<string, unknown>
}

/**
 * Track a single AI completion usage.
 */
export async function trackUsage(input: TrackUsageInput): Promise<void> {
  const db = getDb()

  // Estimate cost based on model
  const costCents = estimateCost(
    input.model,
    input.promptTokens,
    input.completionTokens
  )

  await db.insert(aiUsage).values({
    userId: input.userId,
    model: input.model,
    provider: input.provider,
    promptTokens: input.promptTokens,
    completionTokens: input.completionTokens,
    totalTokens: input.totalTokens,
    costCents: Math.round(costCents),
    latencyMs: input.latencyMs,
    metadata: input.metadata,
  })
}

/**
 * Get usage stats for a user within a time period.
 */
export async function getUserUsage(
  userId: string,
  since: Date
): Promise<{
  totalTokens: number
  totalCostCents: number
  requestCount: number
}> {
  const db = getDb()

  const [result] = await db
    .select({
      totalTokens: sql<number>`COALESCE(SUM(${aiUsage.totalTokens}), 0)`,
      totalCostCents: sql<number>`COALESCE(SUM(${aiUsage.costCents}), 0)`,
      requestCount: sql<number>`count(*)`,
    })
    .from(aiUsage)
    .where(
      and(
        eq(aiUsage.userId, userId),
        gte(aiUsage.createdAt, since)
      )
    )

  // sql<number> is only a TypeScript annotation. node-postgres returns SUM and
  // count(*) (int8/numeric) as strings, so coerce before returning or callers
  // receive strings from a numeric contract.
  return {
    totalTokens: Number(result.totalTokens ?? 0),
    totalCostCents: Number(result.totalCostCents ?? 0),
    requestCount: Number(result.requestCount ?? 0),
  }
}

/**
 * Get recent usage records for a user.
 */
export async function getUsageHistory(
  userId: string,
  limit: number = 50
): Promise<UsageRecord[]> {
  const db = getDb()

  const rows = await db
    .select()
    .from(aiUsage)
    .where(eq(aiUsage.userId, userId))
    // Newest first. Ascending order combined with LIMIT returned the OLDEST n
    // records, so a caller asking for recent history got the first ever rows.
    .orderBy(desc(aiUsage.createdAt))
    .limit(limit)

  return rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    model: row.model,
    provider: row.provider as AIProvider,
    promptTokens: row.promptTokens,
    completionTokens: row.completionTokens,
    totalTokens: row.totalTokens,
    costCents: row.costCents,
    latencyMs: row.latencyMs,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    createdAt: row.createdAt,
  }))
}

/**
 * Rough cost estimation per 1K tokens by model.
 * Reads model costs from AI wrapper config so they can be updated without code changes.
 */
function estimateCost(
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  // Was require() inside a try/catch, which always threw in an ESM module and
  // silently fell back to schema defaults — so configured model costs never
  // applied and every estimate used the built-in table.
  // Zod object defaults replace rather than deep-merge, so a config that lists
  // only some models would send every other model to the generic fallback below
  // instead of its known per-model price. Layer the configured map over the
  // schema defaults so an override is additive.
  const defaults = AIWrapperConfigSchema.parse({}).modelCosts
  const configured = AIWrapperConfigSchema.parse(aiConfig).modelCosts
  const configCosts = { ...defaults, ...configured }

  const modelCosts = configCosts[model] ?? { input: 0.1, output: 0.3 }

  return (
    (promptTokens / 1000) * modelCosts.input +
    (completionTokens / 1000) * modelCosts.output
  )
}
