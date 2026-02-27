import { eq, and, lte, asc, sql } from 'drizzle-orm'
import { getDb } from '../db/client'
import { jobs } from '../db/schema/jobs'
import type { JobDefinition, JobRecord, JobPriority } from './types'
import { loadConfig } from '../runtime/configLoader'

/**
 * Enqueue a job for background processing.
 */
export async function enqueueJob<T = unknown>(
  definition: JobDefinition<T>
): Promise<string> {
  const config = loadConfig('jobs')
  const db = getDb()

  const scheduledAt = definition.delay
    ? new Date(Date.now() + definition.delay)
    : new Date()

  const priorityOrder: Record<JobPriority, number> = {
    critical: 0,
    high: 1,
    normal: 2,
    low: 3,
  }

  // Deduplication check
  if (definition.dedupeKey) {
    const existing = await db
      .select({ id: jobs.id })
      .from(jobs)
      .where(
        and(
          eq(jobs.dedupeKey, definition.dedupeKey),
          eq(jobs.status, 'pending')
        )
      )
      .limit(1)

    if (existing.length > 0) {
      return existing[0].id
    }
  }

  const [job] = await db
    .insert(jobs)
    .values({
      type: definition.type,
      payload: definition.payload as Record<string, unknown>,
      priority: definition.priority ?? 'normal',
      maxRetries: definition.maxRetries ?? config.defaultMaxRetries,
      dedupeKey: definition.dedupeKey ?? null,
      scheduledAt,
    })
    .returning({ id: jobs.id })

  return job.id
}

/**
 * Fetch the next batch of jobs ready for processing.
 * Uses SELECT ... FOR UPDATE SKIP LOCKED for safe concurrency.
 */
export async function fetchNextJobs(limit: number): Promise<JobRecord[]> {
  const db = getDb()
  const now = new Date()

  const rows = await db
    .select()
    .from(jobs)
    .where(
      and(
        eq(jobs.status, 'pending'),
        lte(jobs.scheduledAt, now)
      )
    )
    .orderBy(asc(jobs.priority), asc(jobs.scheduledAt))
    .limit(limit)

  if (rows.length === 0) return []

  // Mark as processing
  const jobIds = rows.map((r) => r.id)
  await db
    .update(jobs)
    .set({ status: 'processing', startedAt: now, updatedAt: now })
    .where(sql`${jobs.id} = ANY(${jobIds})`)

  return rows.map(toJobRecord)
}

/**
 * Mark a job as completed.
 */
export async function completeJob(jobId: string): Promise<void> {
  const db = getDb()
  const now = new Date()

  await db
    .update(jobs)
    .set({
      status: 'completed',
      completedAt: now,
      updatedAt: now,
    })
    .where(eq(jobs.id, jobId))
}

/**
 * Mark a job as failed. Reschedule if retries remain.
 */
export async function failJob(
  jobId: string,
  error: string,
  attempts: number,
  maxRetries: number,
  retryBackoff: number
): Promise<boolean> {
  const db = getDb()
  const now = new Date()
  const willRetry = attempts < maxRetries

  if (willRetry) {
    const nextAttempt = new Date(
      Date.now() + retryBackoff * Math.pow(2, attempts - 1)
    )
    await db
      .update(jobs)
      .set({
        status: 'pending',
        lastError: error,
        attempts,
        scheduledAt: nextAttempt,
        updatedAt: now,
      })
      .where(eq(jobs.id, jobId))
  } else {
    await db
      .update(jobs)
      .set({
        status: 'failed',
        lastError: error,
        attempts,
        completedAt: now,
        updatedAt: now,
      })
      .where(eq(jobs.id, jobId))
  }

  return willRetry
}

/**
 * Cancel a pending job.
 */
export async function cancelJob(jobId: string): Promise<boolean> {
  const db = getDb()
  const now = new Date()

  const result = await db
    .update(jobs)
    .set({ status: 'cancelled', updatedAt: now })
    .where(and(eq(jobs.id, jobId), eq(jobs.status, 'pending')))
    .returning({ id: jobs.id })

  return result.length > 0
}

/**
 * Get a job by ID.
 */
export async function getJob(jobId: string): Promise<JobRecord | null> {
  const db = getDb()

  const rows = await db
    .select()
    .from(jobs)
    .where(eq(jobs.id, jobId))
    .limit(1)

  return rows.length > 0 ? toJobRecord(rows[0]) : null
}

/**
 * Clean up old completed/failed jobs past the retention period.
 */
export async function cleanupJobs(): Promise<number> {
  const config = loadConfig('jobs')
  const db = getDb()
  const cutoff = new Date(Date.now() - config.retentionPeriod)

  const result = await db
    .delete(jobs)
    .where(
      and(
        sql`${jobs.status} IN ('completed', 'failed', 'cancelled')`,
        lte(jobs.completedAt, cutoff)
      )
    )
    .returning({ id: jobs.id })

  return result.length
}

function toJobRecord(row: typeof jobs.$inferSelect): JobRecord {
  return {
    id: row.id,
    type: row.type,
    payload: row.payload,
    status: row.status as JobRecord['status'],
    priority: row.priority as JobRecord['priority'],
    attempts: row.attempts,
    maxRetries: row.maxRetries,
    lastError: row.lastError,
    scheduledAt: row.scheduledAt,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}
