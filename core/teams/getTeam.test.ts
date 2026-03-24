import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../db/client', () => ({ getDb: vi.fn() }))
vi.mock('../db/schema/teams', () => ({
  teams: { id: 'id', slug: 'slug', ownerId: 'ownerId' },
  teamMembers: { id: 'id', teamId: 'teamId', userId: 'userId', role: 'role', joinedAt: 'joinedAt' },
  teamInvitations: { id: 'id', teamId: 'teamId', email: 'email', role: 'role', token: 'token', expiresAt: 'expiresAt', acceptedAt: 'acceptedAt', createdAt: 'createdAt', invitedBy: 'invitedBy' },
}))
vi.mock('../db/schema/users', () => ({
  users: { id: 'id', email: 'email', name: 'name' },
}))
vi.mock('drizzle-orm', () => ({ eq: vi.fn((a, b) => ({ a, b })), and: vi.fn((...a) => a), sql: vi.fn() }))
vi.mock('../errors/types', () => {
  class NotFoundError extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'NotFoundError'
    }
  }
  return { NotFoundError }
})

import { getDb } from '../db/client'
import { getTeam, getTeamBySlug, getUserTeams, getTeamMembers, getUserTeamRole } from './getTeam'

const teamRow = {
  id: 'team-1',
  name: 'Test Team',
  slug: 'test-team',
  ownerId: 'user-1',
  avatarUrl: null,
  metadata: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

function createMockDb() {
  const mockLimit = vi.fn()
  const mockInnerJoin = vi.fn()
  const mockOrderBy = vi.fn()
  const mockWhere = vi.fn(() => ({ limit: mockLimit, orderBy: mockOrderBy }))
  const mockFrom = vi.fn(() => ({ where: mockWhere, innerJoin: mockInnerJoin }))
  const mockSelect = vi.fn(() => ({ from: mockFrom }))

  return { db: { select: mockSelect }, mockSelect, mockFrom, mockWhere, mockLimit, mockInnerJoin, mockOrderBy }
}

describe('getTeam', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns team when found', async () => {
    const { db, mockLimit } = createMockDb()
    vi.mocked(getDb).mockReturnValue(db as never)
    mockLimit.mockResolvedValueOnce([teamRow])

    const result = await getTeam('team-1')
    expect(result.id).toBe('team-1')
    expect(result.name).toBe('Test Team')
    expect(result.metadata).toEqual({})
  })

  it('throws NotFoundError when team not found', async () => {
    const { db, mockLimit } = createMockDb()
    vi.mocked(getDb).mockReturnValue(db as never)
    mockLimit.mockResolvedValueOnce([])

    await expect(getTeam('nonexistent')).rejects.toThrow('Team not found')
  })
})

describe('getTeamBySlug', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns team when found by slug', async () => {
    const { db, mockLimit } = createMockDb()
    vi.mocked(getDb).mockReturnValue(db as never)
    mockLimit.mockResolvedValueOnce([teamRow])

    const result = await getTeamBySlug('test-team')
    expect(result.id).toBe('team-1')
    expect(result.slug).toBe('test-team')
  })

  it('throws NotFoundError when slug not found', async () => {
    const { db, mockLimit } = createMockDb()
    vi.mocked(getDb).mockReturnValue(db as never)
    mockLimit.mockResolvedValueOnce([])

    await expect(getTeamBySlug('no-such-slug')).rejects.toThrow('Team not found')
  })
})

describe('getUserTeams', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns teams with roles', async () => {
    const { db, mockInnerJoin } = createMockDb()
    vi.mocked(getDb).mockReturnValue(db as never)

    const mockWhere2 = vi.fn().mockResolvedValueOnce([
      { team: teamRow, role: 'owner' },
    ])
    mockInnerJoin.mockReturnValueOnce({ where: mockWhere2 })

    const result = await getUserTeams('user-1')
    expect(result).toHaveLength(1)
    expect(result[0].role).toBe('owner')
    expect(result[0].id).toBe('team-1')
  })

  it('returns empty array when user has no teams', async () => {
    const { db, mockInnerJoin } = createMockDb()
    vi.mocked(getDb).mockReturnValue(db as never)

    const mockWhere2 = vi.fn().mockResolvedValueOnce([])
    mockInnerJoin.mockReturnValueOnce({ where: mockWhere2 })

    const result = await getUserTeams('user-2')
    expect(result).toEqual([])
  })
})

describe('getTeamMembers', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns members with email and name', async () => {
    const { db, mockInnerJoin } = createMockDb()
    vi.mocked(getDb).mockReturnValue(db as never)

    const memberRow = {
      member: { id: 'mem-1', teamId: 'team-1', userId: 'user-1', role: 'owner', joinedAt: new Date() },
      email: 'owner@test.com',
      name: 'Owner',
    }
    const mockWhere2 = vi.fn().mockResolvedValueOnce([memberRow])
    mockInnerJoin.mockReturnValueOnce({ where: mockWhere2 })

    const result = await getTeamMembers('team-1')
    expect(result).toHaveLength(1)
    expect(result[0].email).toBe('owner@test.com')
    expect(result[0].name).toBe('Owner')
    expect(result[0].role).toBe('owner')
  })
})

describe('getUserTeamRole', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns role when user is a member', async () => {
    const { db, mockLimit } = createMockDb()
    vi.mocked(getDb).mockReturnValue(db as never)
    mockLimit.mockResolvedValueOnce([{ role: 'admin' }])

    const result = await getUserTeamRole('team-1', 'user-1')
    expect(result).toBe('admin')
  })

  it('returns null when user is not a member', async () => {
    const { db, mockLimit } = createMockDb()
    vi.mocked(getDb).mockReturnValue(db as never)
    mockLimit.mockResolvedValueOnce([])

    const result = await getUserTeamRole('team-1', 'user-999')
    expect(result).toBeNull()
  })
})
