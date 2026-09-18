import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('./queue', () => ({
  fetchNextJobs: vi.fn().mockResolvedValue([]),
  completeJob: vi.fn().mockResolvedValue(undefined),
  failJob: vi.fn().mockResolvedValue(false),
}))
vi.mock('../runtime/hookRunner', () => ({
  runHook: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('../runtime/configLoader', () => ({
  loadConfig: vi.fn().mockReturnValue({
    concurrency: 5,
    pollInterval: 1000,
    defaultRetryBackoff: 1000,
    defaultTimeout: 300000,
  }),
}))

import {
  registerJobHandler,
  startWorker,
  stopWorker,
  isWorkerRunning,
  getRegisteredJobTypes,
} from './worker'
import { fetchNextJobs, completeJob, failJob } from './queue'
import type { JobRecord } from './types'

describe('worker', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // Ensure worker is stopped before each test
    stopWorker()
    vi.clearAllMocks()
  })

  afterEach(() => {
    stopWorker()
    vi.useRealTimers()
  })

  describe('registerJobHandler', () => {
    it('registers a handler for a job type', () => {
      const handler = vi.fn()
      registerJobHandler('send-email', handler)

      expect(getRegisteredJobTypes()).toContain('send-email')
    })

    it('overwrites handler when registering the same type', () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()
      registerJobHandler('send-email', handler1)
      registerJobHandler('send-email', handler2)

      // Still only one entry for that type
      const types = getRegisteredJobTypes().filter((t) => t === 'send-email')
      expect(types).toHaveLength(1)
    })
  })

  describe('getRegisteredJobTypes', () => {
    it('returns all registered type keys', () => {
      registerJobHandler('type-a', vi.fn())
      registerJobHandler('type-b', vi.fn())

      const types = getRegisteredJobTypes()
      expect(types).toContain('type-a')
      expect(types).toContain('type-b')
    })
  })

  describe('isWorkerRunning', () => {
    it('returns false when worker has not been started', () => {
      expect(isWorkerRunning()).toBe(false)
    })

    it('returns true after startWorker is called', () => {
      startWorker()
      expect(isWorkerRunning()).toBe(true)
    })

    it('returns false after stopWorker is called', () => {
      startWorker()
      stopWorker()
      expect(isWorkerRunning()).toBe(false)
    })
  })

  describe('startWorker / stopWorker', () => {
    it('starts polling for jobs', async () => {
      vi.mocked(fetchNextJobs).mockResolvedValue([])

      startWorker()

      // Let the initial poll complete
      await vi.advanceTimersByTimeAsync(0)

      // Second argument is the reclaim lease — 3x the 300000ms defaultTimeout.
      expect(fetchNextJobs).toHaveBeenCalledWith(5, 900000)
    })

    it('does not start twice if already running', async () => {
      vi.mocked(fetchNextJobs).mockResolvedValue([])

      startWorker()
      startWorker()

      await vi.advanceTimersByTimeAsync(0)

      // fetchNextJobs should have been called only once (not twice)
      expect(fetchNextJobs).toHaveBeenCalledTimes(1)
    })

    it('stops the poll timer on stopWorker', async () => {
      vi.mocked(fetchNextJobs).mockResolvedValue([])

      startWorker()
      await vi.advanceTimersByTimeAsync(0)

      stopWorker()
      expect(isWorkerRunning()).toBe(false)

      // Advance time past the poll interval — no more polls should happen
      const callCount = vi.mocked(fetchNextJobs).mock.calls.length
      await vi.advanceTimersByTimeAsync(5000)
      expect(vi.mocked(fetchNextJobs).mock.calls.length).toBe(callCount)
    })

    it('polls again after pollInterval when running', async () => {
      vi.mocked(fetchNextJobs).mockResolvedValue([])

      startWorker()
      await vi.advanceTimersByTimeAsync(0)
      expect(fetchNextJobs).toHaveBeenCalledTimes(1)

      // Advance by pollInterval to trigger next poll
      await vi.advanceTimersByTimeAsync(1000)
      expect(fetchNextJobs).toHaveBeenCalledTimes(2)
    })
  })

  /**
   * Job execution, which every other test in this file skips: they mock
   * fetchNextJobs to return an empty batch, so no handler is ever invoked and
   * neither the timeout nor its cancellation is exercised.
   *
   * What matters here is that the timeout is *cooperative*. Promise.race
   * abandons the wait; it cannot stop the handler. So a timed-out job keeps
   * running while the worker marks it failed and schedules a retry, and the
   * retry duplicates whatever side effect the first attempt was midway through
   * — a second charge, a second email. The AbortSignal is the only thing a
   * handler can act on.
   */
  describe('running a job', () => {
    const job: JobRecord = {
      id: 'job-1',
      type: 'timed-job',
      payload: { to: 'someone@example.com' },
      status: 'processing',
      priority: 'normal',
      attempts: 0,
      maxRetries: 3,
      lastError: null,
      scheduledAt: new Date(),
      startedAt: new Date(),
      completedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    function queueOneJob(): void {
      vi.mocked(fetchNextJobs).mockResolvedValueOnce([job]).mockResolvedValue([])
    }

    it('passes a live signal to the handler and cancels it on success', async () => {
      let seen: AbortSignal | undefined
      registerJobHandler('timed-job', async (_payload, ctx) => {
        seen = ctx.signal
      })
      queueOneJob()

      startWorker()
      await vi.advanceTimersByTimeAsync(0)

      expect(seen).toBeDefined()
      expect(seen?.aborted).toBe(false)
      expect(completeJob).toHaveBeenCalledWith('job-1')

      // The timeout timer must be cleared when the job finishes early. If it
      // were not, it would still fire — and, at 5 minutes per completed job,
      // hold a timer open for every job the worker has ever run.
      stopWorker()
      await vi.advanceTimersByTimeAsync(400_000)
      expect(seen?.aborted).toBe(false)
    })

    it('aborts the signal when the job outlives its timeout', async () => {
      let seen: AbortSignal | undefined
      registerJobHandler('timed-job', (_payload, ctx) => {
        seen = ctx.signal
        // Never settles: the handler that ignores its signal is exactly the
        // case the abort exists for.
        return new Promise<void>(() => undefined)
      })
      queueOneJob()

      startWorker()
      await vi.advanceTimersByTimeAsync(0)
      expect(seen?.aborted).toBe(false)

      // defaultTimeout is 300000 in the mocked config above.
      await vi.advanceTimersByTimeAsync(300_001)

      expect(seen?.aborted).toBe(true)
      expect(failJob).toHaveBeenCalled()
      expect(completeJob).not.toHaveBeenCalled()
    })
  })
})
