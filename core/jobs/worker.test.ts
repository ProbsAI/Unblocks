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
import { fetchNextJobs } from './queue'

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

      expect(fetchNextJobs).toHaveBeenCalledWith(5)
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
})
