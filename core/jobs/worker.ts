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
          const timeout = createTimeout(config.defaultTimeout, job.type)

          // Only a handler or timeout failure may fail the job. Everything
          // after the job is marked complete is deliberately outside this try:
          // letting a post-completion error reach the catch would move an
          // already-completed job back to pending and retry it, duplicating
          // whatever side effect it had already performed successfully.
          let failure: unknown
          let failed = false

          try {
            // Promise.race abandons the wait; it does not cancel the handler.
            // The signal is the only way a handler can actually be stopped, and
            // without one a timed-out job keeps running while the worker marks
            // it failed and retries — so the retry duplicates whatever side
            // effect the first attempt was midway through.
            await Promise.race([
              handler(job.payload, { signal: timeout.signal }),
              timeout.promise,
            ])
          } catch (err) {
            failure = err
            failed = true
          }

          if (!failed) {
            timeout.cancel()
            await completeJob(job.id)

            const hookArgs: OnJobCompletedArgs = {
              jobId: job.id,
              type: job.type,
              payload: job.payload,
              duration: Date.now() - startTime,
            }
            await runHook('onJobCompleted', hookArgs)
            return
          }

          // Release the timer on the failure path too: Promise.race leaves the
          // loser pending, so a job that failed fast would otherwise strand a
          // live timer for the full timeout duration.
          timeout.cancel()

          const error =
            failure instanceof Error ? failure.message : String(failure)
          const attempts = job.attempts + 1
          const willRetry = await failJob(
            job.id,
            error,
            attempts,
            job.maxRetries,
            config.defaultRetryBackoff
          )

          const failedArgs: OnJobFailedArgs = {
            jobId: job.id,
            type: job.type,
            payload: job.payload,
            error,
            attempts,
            willRetry,
          }
          await runHook('onJobFailed', failedArgs)
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

/**
 * A timeout promise plus the means to cancel it.
 *
 * Promise.race leaves the loser pending, so without cancel() every completed
 * job would strand a live timer for the full timeout duration — leaking memory
 * and holding the event loop open on shutdown.
 */
function createTimeout(
  ms: number,
  jobType: string
): { promise: Promise<never>; signal: AbortSignal; cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | undefined
  const controller = new AbortController()

  const promise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      // Abort first, so a cooperating handler starts unwinding before the race
      // rejects and the worker moves on to schedule a retry.
      controller.abort(new Error(`Job ${jobType} timed out after ${ms}ms`))
      reject(new Error(`Job ${jobType} timed out after ${ms}ms`))
    }, ms)
  })

  return {
    promise,
    signal: controller.signal,
    cancel: () => {
      if (timer !== undefined) clearTimeout(timer)
    },
  }
}
