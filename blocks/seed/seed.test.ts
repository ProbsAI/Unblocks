import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../core/db/client', () => ({ getDb: vi.fn() }))
vi.mock('../../core/db/schema/users', () => ({ users: {} }))
vi.mock('../../core/db/schema/teams', () => ({ teams: {}, teamMembers: {} }))
vi.mock('../../core/db/schema/notifications', () => ({ notifications: {} }))
vi.mock('../../core/db/schema/jobs', () => ({ jobs: {} }))
vi.mock('../../core/db/schema/files', () => ({ files: {} }))
vi.mock('drizzle-orm', () => ({ sql: vi.fn() }))

import { seed } from './seed'
import { getDb } from '../../core/db/client'
import type { SeedResult } from './types'

function createMockDb(): Record<string, ReturnType<typeof vi.fn>> {
  const returning = vi.fn().mockResolvedValue([{ id: `id-${Math.random().toString(36).slice(2)}` }])
  const values = vi.fn().mockReturnValue({ returning })
  const insert = vi.fn().mockReturnValue({ values })
  const execute = vi.fn().mockResolvedValue(undefined)

  return { insert, values, returning, execute }
}

describe('seed', () => {
  let mockDb: ReturnType<typeof createMockDb>

  beforeEach(() => {
    vi.clearAllMocks()
    mockDb = createMockDb()
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>)
  })

  it('returns SeedResult with correct counts using defaults', async () => {
    const result: SeedResult = await seed()

    expect(result.users).toBe(20)
    expect(result.admins).toBe(2)
    expect(result.teams).toBe(5)
    expect(result.notifications).toBe(220) // (20 + 2) * 10
    expect(result.jobs).toBe(30)
    expect(result.files).toBe(15)
    expect(result.duration).toBeGreaterThanOrEqual(0)
    expect(result.teamMembers).toBeGreaterThanOrEqual(5) // at least one per team (owner)
  })

  it('respects config overrides', async () => {
    const result = await seed({
      userCount: 3,
      adminCount: 1,
      teamCount: 2,
      notificationsPerUser: 2,
      jobCount: 5,
      fileCount: 4,
      clearFirst: false,
    })

    expect(result.users).toBe(3)
    expect(result.admins).toBe(1)
    expect(result.teams).toBe(2)
    expect(result.notifications).toBe(8) // (3 + 1) * 2
    expect(result.jobs).toBe(5)
    expect(result.files).toBe(4)

    // clearFirst=false means execute should not be called for truncation
    expect(mockDb.execute).not.toHaveBeenCalled()
  })

  it('truncates tables when clearFirst is true', async () => {
    await seed({ clearFirst: true, userCount: 1, adminCount: 0, teamCount: 0, notificationsPerUser: 0, jobCount: 0, fileCount: 0 })

    expect(mockDb.execute).toHaveBeenCalledTimes(1)
  })

  it('does not truncate tables when clearFirst is false', async () => {
    await seed({ clearFirst: false, userCount: 1, adminCount: 0, teamCount: 0, notificationsPerUser: 0, jobCount: 0, fileCount: 0 })

    expect(mockDb.execute).not.toHaveBeenCalled()
  })

  it('inserts correct number of users', async () => {
    await seed({ userCount: 3, adminCount: 1, teamCount: 0, notificationsPerUser: 0, jobCount: 0, fileCount: 0 })

    // Total users = userCount + adminCount = 4
    expect(mockDb.insert).toHaveBeenCalledTimes(4)
  })

  it('returns duration as a non-negative number', async () => {
    const result = await seed({ userCount: 0, adminCount: 0, teamCount: 0, notificationsPerUser: 0, jobCount: 0, fileCount: 0 })

    expect(typeof result.duration).toBe('number')
    expect(result.duration).toBeGreaterThanOrEqual(0)
  })
})
