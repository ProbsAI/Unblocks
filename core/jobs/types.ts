import { z } from 'zod'

// --- Job Status ---

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'

// --- Job Priority ---

export type JobPriority = 'low' | 'normal' | 'high' | 'critical'

// --- Job Definition ---

export interface JobDefinition<T = unknown> {
  /** Unique job type name */
  type: string
  /** Job payload */
  payload: T
  /** Priority level */
  priority?: JobPriority
  /** Delay before processing (ms) */
  delay?: number
  /** Max retry attempts */
  maxRetries?: number
  /** Retry backoff in ms (doubles each retry) */
  retryBackoff?: number
  /** Timeout in ms */
  timeout?: number
  /** Unique key for deduplication */
  dedupeKey?: string
}

// --- Job Record (DB) ---

export interface JobRecord {
  id: string
  type: string
  payload: unknown
  status: JobStatus
  priority: JobPriority
  attempts: number
  maxRetries: number
  lastError: string | null
  scheduledAt: Date
  startedAt: Date | null
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

// --- Job Handler ---

/**
 * A job handler.
 *
 * The second argument carries an AbortSignal that fires when the job exceeds
 * `defaultTimeout`. Honour it for anything with side effects.
 *
 * The worker cannot stop a handler on its own — `Promise.race` abandons the
 * wait, it does not cancel the work. So a handler that ignores the signal keeps
 * running after the timeout while the job is marked failed and retried, and the
 * retry then duplicates whatever the first attempt was in the middle of: a
 * second charge, a second email, a second upload. Pass the signal to `fetch`,
 * or check `signal.aborted` between steps.
 */
export type JobHandler<T = unknown> = (
  payload: T,
  context: JobContext
) => Promise<void>

export interface JobContext {
  /** Aborts when the job's timeout elapses. */
  signal: AbortSignal
}

// --- Scheduled Job ---

export interface ScheduledJobDefinition {
  /** Unique name for the scheduled job */
  name: string
  /** Cron expression (e.g., '0 * * * *' for every hour) */
  cron: string
  /** Job type to create */
  jobType: string
  /** Payload for the job */
  payload?: unknown
  /** Whether this schedule is enabled */
  enabled?: boolean
}

// --- Config ---

export const JobsConfigSchema = z.object({
  /** Enable the job queue system */
  enabled: z.boolean().default(true),

  /** Queue backend: 'memory' for dev, 'database' for production */
  backend: z.enum(['memory', 'database']).default('database'),

  /** Worker concurrency (how many jobs to process simultaneously) */
  concurrency: z.number().min(1).max(50).default(5),

  /** Default max retries for failed jobs */
  defaultMaxRetries: z.number().min(0).max(20).default(3),

  /** Default retry backoff in ms */
  defaultRetryBackoff: z.number().min(100).default(1000),

  /** Default job timeout in ms (5 minutes) */
  defaultTimeout: z.number().min(1000).default(300_000),

  /** How often to poll for new jobs (ms) */
  pollInterval: z.number().min(100).default(1000),

  /** How long to keep completed jobs before cleanup (ms, default 7 days) */
  retentionPeriod: z.number().default(7 * 24 * 60 * 60 * 1000),

  /** Scheduled jobs */
  schedules: z.array(z.object({
    name: z.string(),
    cron: z.string(),
    jobType: z.string(),
    payload: z.unknown().optional(),
    enabled: z.boolean().default(true),
  })).default([]),
})

export type JobsConfig = z.infer<typeof JobsConfigSchema>

// --- Hook Args ---

export interface OnJobCompletedArgs {
  jobId: string
  type: string
  payload: unknown
  duration: number
}

export interface OnJobFailedArgs {
  jobId: string
  type: string
  payload: unknown
  error: string
  attempts: number
  willRetry: boolean
}
