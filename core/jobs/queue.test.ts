import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../db/client', () => ({ getDb: vi.fn() }))
vi.mock('../db/schema/jobs', () => ({
  jobs: {
    id: 'id',
    status: 'status',
    dedupeKey: 'dedupeKey',
    completedAt: 'completedAt',
  },
}))
vi.mock('../runtime/configLoader', () => ({
  loadConfig: vi.fn().mockReturnValue({
    defaultMaxRetries: 3,
    retentionPeriod: 604800000,
  }),
}))
vi.mock('../security/encryption', () => ({
  encrypt: vi.fn((v: string) => 'enc_' + v),
}))
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a: unknown, b: unknown) => ({ a, b })),
  and: vi.fn((...args: unknown[]) => args),
  lte: vi.fn((a: unknown, b: unknown) => ({ a, b })),
  sql: vi.fn(),
}))

import { getDb } from '../db/client'
import {
  enqueueJob,
  completeJob,
  failJob,
  cancelJob,
  getJob,
  cleanupJobs,
} from './queue'

function createMockDb() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}

  chain.select = vi.fn().mockReturnValue(chain)
  chain.from = vi.fn().mockReturnValue(chain)
  chain.where = vi.fn().mockReturnValue(chain)
  chain.limit = vi.fn().mockResolvedValue([])
  chain.insert = vi.fn().mockReturnValue(chain)
  chain.values = vi.fn().mockReturnValue(chain)
  chain.returning = vi.fn().mockResolvedValue([{ id: 'job-1' }])
  chain.update = vi.fn().mockReturnValue(chain)
  chain.set = vi.fn().mockReturnValue(chain)
  chain.delete = vi.fn().mockReturnValue(chain)
  chain.execute = vi.fn().mockResolvedValue({ rows: [] })

  return chain
}

describe('queue', () => {
  let mockDb: ReturnType<typeof createMockDb>

  beforeEach(() => {
    vi.clearAllMocks()
    mockDb = createMockDb()
    vi.mocked(getDb).mockReturnValue(mockDb as never)
  })

  describe('enqueueJob', () => {
    it('inserts a job and returns the id', async () => {
      mockDb.returning.mockResolvedValue([{ id: 'job-new' }])

      const id = await enqueueJob({
        type: 'send-email',
        payload: { to: 'a@b.com' },
      })

      expect(id).toBe('job-new')
      expect(mockDb.insert).toHaveBeenCalled()
      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'send-email',
          priority: 'normal',
          maxRetries: 3,
          dedupeKey: null,
        })
      )
    })

    it('returns existing job id when dedupeKey matches a pending job', async () => {
      // The .limit() call in the dedupe select returns a match
      mockDb.limit.mockResolvedValueOnce([{ id: 'existing-job' }])

      const id = await enqueueJob({
        type: 'send-email',
        payload: { to: 'a@b.com' },
        dedupeKey: 'email-a@b.com',
      })

      expect(id).toBe('existing-job')
      // insert should NOT have been called because dedupe found an existing job
      expect(mockDb.insert).not.toHaveBeenCalled()
    })

    it('inserts when dedupeKey has no pending match', async () => {
      mockDb.limit.mockResolvedValueOnce([])
      mockDb.returning.mockResolvedValue([{ id: 'new-job' }])

      const id = await enqueueJob({
        type: 'send-email',
        payload: { to: 'a@b.com' },
        dedupeKey: 'email-a@b.com',
      })

      expect(id).toBe('new-job')
      expect(mockDb.insert).toHaveBeenCalled()
    })

    it('encrypts the payload', async () => {
      const { encrypt } = await import('../security/encryption')
      mockDb.returning.mockResolvedValue([{ id: 'job-enc' }])

      await enqueueJob({
        type: 'process',
        payload: { secret: '123' },
      })

      expect(encrypt).toHaveBeenCalledWith(
        JSON.stringify({ secret: '123' })
      )
      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          payloadEncrypted: 'enc_{"secret":"123"}',
        })
      )
    })
  })

  describe('completeJob', () => {
    it('updates job status to completed', async () => {
      await completeJob('job-1')

      expect(mockDb.update).toHaveBeenCalled()
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'completed' })
      )
    })
  })

  describe('failJob', () => {
    it('reschedules as pending when attempts < maxRetries', async () => {
      const willRetry = await failJob('job-1', 'timeout', 1, 3, 1000)

      expect(willRetry).toBe(true)
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'pending',
          lastError: 'timeout',
          attempts: 1,
        })
      )
    })

    it('marks as failed when attempts >= maxRetries', async () => {
      const willRetry = await failJob('job-1', 'timeout', 3, 3, 1000)

      expect(willRetry).toBe(false)
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          lastError: 'timeout',
          attempts: 3,
        })
      )
    })
  })

  describe('cancelJob', () => {
    it('returns true when a pending job is cancelled', async () => {
      mockDb.returning.mockResolvedValue([{ id: 'job-1' }])

      const result = await cancelJob('job-1')

      expect(result).toBe(true)
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'cancelled' })
      )
    })

    it('returns false when no pending job matches', async () => {
      mockDb.returning.mockResolvedValue([])

      const result = await cancelJob('job-1')

      expect(result).toBe(false)
    })
  })

  describe('getJob', () => {
    it('returns a JobRecord when found', async () => {
      const mockRow = {
        id: 'job-1',
        type: 'send-email',
        payload: { to: 'a@b.com' },
        status: 'pending',
        priority: 'normal',
        attempts: 0,
        maxRetries: 3,
        lastError: null,
        scheduledAt: new Date('2026-01-01'),
        startedAt: null,
        completedAt: null,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
      }
      mockDb.limit.mockResolvedValue([mockRow])

      const job = await getJob('job-1')

      expect(job).not.toBeNull()
      expect(job!.id).toBe('job-1')
      expect(job!.type).toBe('send-email')
    })

    it('returns null when not found', async () => {
      mockDb.limit.mockResolvedValue([])

      const job = await getJob('nonexistent')

      expect(job).toBeNull()
    })
  })

  describe('cleanupJobs', () => {
    it('deletes old completed/failed/cancelled jobs and returns count', async () => {
      mockDb.returning.mockResolvedValue([{ id: 'j1' }, { id: 'j2' }])

      const count = await cleanupJobs()

      expect(count).toBe(2)
      expect(mockDb.delete).toHaveBeenCalled()
    })

    it('returns 0 when no jobs to clean up', async () => {
      mockDb.returning.mockResolvedValue([])

      const count = await cleanupJobs()

      expect(count).toBe(0)
    })
  })
})
