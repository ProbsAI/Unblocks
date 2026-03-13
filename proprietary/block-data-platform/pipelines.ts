import { eq, desc } from 'drizzle-orm'
import { getDb } from '../../core/db/client'
import { pipelines, pipelineRuns } from './schema'
import { enqueueJob } from '../../core/jobs/queue'
import type { Pipeline, PipelineRun, PipelineStep } from './types'

/**
 * Create a new pipeline.
 */
export async function createPipeline(
  userId: string,
  data: {
    name: string
    description?: string
    steps: PipelineStep[]
    schedule?: string
    teamId?: string
  }
): Promise<Pipeline> {
  const db = getDb()

  const [row] = await db
    .insert(pipelines)
    .values({
      userId,
      teamId: data.teamId ?? null,
      name: data.name,
      description: data.description ?? '',
      steps: data.steps as unknown as Record<string, unknown>,
      schedule: data.schedule ?? null,
      status: 'draft',
    })
    .returning()

  return toPipeline(row)
}

/**
 * Get a pipeline by ID.
 */
export async function getPipeline(pipelineId: string): Promise<Pipeline | null> {
  const db = getDb()

  const rows = await db
    .select()
    .from(pipelines)
    .where(eq(pipelines.id, pipelineId))
    .limit(1)

  return rows.length > 0 ? toPipeline(rows[0]) : null
}

/**
 * List pipelines for a user.
 */
export async function listPipelines(userId: string): Promise<Pipeline[]> {
  const db = getDb()

  const rows = await db
    .select()
    .from(pipelines)
    .where(eq(pipelines.userId, userId))
    .orderBy(desc(pipelines.createdAt))

  return rows.map(toPipeline)
}

/**
 * Trigger a pipeline run. Enqueues a background job.
 */
export async function triggerPipelineRun(
  pipelineId: string
): Promise<PipelineRun> {
  const db = getDb()

  const [run] = await db
    .insert(pipelineRuns)
    .values({
      pipelineId,
      status: 'pending',
    })
    .returning()

  // Enqueue background job for pipeline execution
  await enqueueJob({
    type: 'data:run-pipeline',
    payload: { pipelineId, runId: run.id },
    priority: 'normal',
  })

  return toRun(run)
}

/**
 * Get runs for a pipeline.
 */
export async function getPipelineRuns(
  pipelineId: string,
  limit: number = 20
): Promise<PipelineRun[]> {
  const db = getDb()

  const rows = await db
    .select()
    .from(pipelineRuns)
    .where(eq(pipelineRuns.pipelineId, pipelineId))
    .orderBy(desc(pipelineRuns.startedAt))
    .limit(limit)

  return rows.map(toRun)
}

/**
 * Update a pipeline's status.
 */
export async function updatePipelineStatus(
  pipelineId: string,
  status: Pipeline['status']
): Promise<void> {
  const db = getDb()

  await db
    .update(pipelines)
    .set({ status, updatedAt: new Date() })
    .where(eq(pipelines.id, pipelineId))
}

function toPipeline(row: typeof pipelines.$inferSelect): Pipeline {
  return {
    id: row.id,
    userId: row.userId,
    teamId: row.teamId,
    name: row.name,
    description: row.description ?? '',
    steps: (row.steps ?? []) as unknown as PipelineStep[],
    schedule: row.schedule,
    status: row.status as Pipeline['status'],
    lastRunAt: row.lastRunAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function toRun(row: typeof pipelineRuns.$inferSelect): PipelineRun {
  return {
    id: row.id,
    pipelineId: row.pipelineId,
    status: row.status as PipelineRun['status'],
    rowsProcessed: row.rowsProcessed,
    error: row.error,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    durationMs: row.durationMs,
  }
}
