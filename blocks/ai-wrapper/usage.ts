import { eq, and, gte, sql } from 'drizzle-orm'
import { getDb } from '../../core/db/client'
import { aiUsage } from './schema'
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
    costCents: Math.round(costCents * 100),
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

  return {
    totalTokens: result.totalTokens,
    totalCostCents: result.totalCostCents,
    requestCount: result.requestCount,
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
    .orderBy(aiUsage.createdAt)
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
  let configCosts: Record<string, { input: number; output: number }> = {}
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const configModule = require('../../config/ai-wrapper.config')
    const config = configModule.default ?? configModule
    configCosts = config?.modelCosts ?? {}
  } catch {
    // No config file — use defaults from schema
  }

  const modelCosts = configCosts[model] ?? { input: 0.1, output: 0.3 }

  return (
    (promptTokens / 1000) * modelCosts.input +
    (completionTokens / 1000) * modelCosts.output
  )
}
