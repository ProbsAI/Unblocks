import { fetchNextJobs, completeJob, failJob } from './queue'
import { runHook } from '../runtime/hookRunner'
import { loadConfig } from '../runtime/configLoader'
import type { JobHandler, OnJobCompletedArgs, OnJobFailedArgs } from './types'

const handlers = new Map<string, JobHandler>()
let running = false
let pollTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Register a handler for a job type.
 */
export function registerJobHandler<T = unknown>(
  type: string,
  handler: JobHandler<T>
): void {
  handlers.set(type, handler as JobHandler)
}

/**
 * Start the job worker. Polls for jobs and processes them.
 */
export function startWorker(): void {
  if (running) return
  running = true
  poll()
}

/**
 * Stop the job worker gracefully.
 */
export function stopWorker(): void {
  running = false
  if (pollTimer) {
    clearTimeout(pollTimer)
    pollTimer = null
  }
}

/**
 * Check if the worker is running.
 */
export function isWorkerRunning(): boolean {
  return running
}

/**
 * Get all registered job handler types.
 */
export function getRegisteredJobTypes(): string[] {
  return Array.from(handlers.keys())
}

async function poll(): Promise<void> {
  if (!running) return

  const config = loadConfig('jobs')

  try {
    const batch = await fetchNextJobs(config.concurrency)

    if (batch.length > 0) {
      await Promise.allSettled(
        batch.map(async (job) => {
          const handler = handlers.get(job.type)

          if (!handler) {
            await failJob(
              job.id,
              `No handler registered for job type: ${job.type}`,
              job.attempts + 1,
              job.maxRetries,
              config.defaultRetryBackoff
            )
            return
          }

          const startTime = Date.now()

          try {
            // Run with timeout
            await Promise.race([
              handler(job.payload),
              createTimeout(config.defaultTimeout, job.type),
            ])

            await completeJob(job.id)

            const hookArgs: OnJobCompletedArgs = {
              jobId: job.id,
              type: job.type,
              payload: job.payload,
              duration: Date.now() - startTime,
            }
            await runHook('onJobCompleted', hookArgs)
          } catch (err) {
            const error = err instanceof Error ? err.message : String(err)
            const attempts = job.attempts + 1
            const willRetry = await failJob(
              job.id,
              error,
              attempts,
              job.maxRetries,
              config.defaultRetryBackoff
            )

            const hookArgs: OnJobFailedArgs = {
              jobId: job.id,
              type: job.type,
              payload: job.payload,
              error,
              attempts,
              willRetry,
            }
            await runHook('onJobFailed', hookArgs)
          }
        })
      )
    }
  } catch (err) {
    console.error('[jobs] Worker poll error:', err)
  }

  // Schedule next poll
  if (running) {
    const config = loadConfig('jobs')
    pollTimer = setTimeout(poll, config.pollInterval)
  }
}

function createTimeout(ms: number, jobType: string): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Job ${jobType} timed out after ${ms}ms`)), ms)
  })
}
