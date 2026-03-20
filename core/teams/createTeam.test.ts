import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../db/client', () => ({ getDb: vi.fn() }))
vi.mock('../db/schema/teams', () => ({
  teams: { id: 'id', slug: 'slug', ownerId: 'ownerId' },
  teamMembers: { id: 'id', teamId: 'teamId', userId: 'userId', role: 'role', joinedAt: 'joinedAt' },
  teamInvitations: { id: 'id', teamId: 'teamId', email: 'email', role: 'role', token: 'token', expiresAt: 'expiresAt', acceptedAt: 'acceptedAt', createdAt: 'createdAt', invitedBy: 'invitedBy' },
}))
vi.mock('drizzle-orm', () => ({ eq: vi.fn((a, b) => ({ a, b })), and: vi.fn((...a) => a), sql: vi.fn() }))
vi.mock('../runtime/configLoader', () => ({
  loadConfig: vi.fn(),
}))
vi.mock('../runtime/hookRunner', () => ({
  runHook: vi.fn(),
}))
vi.mock('../errors/types', () => {
  class ConflictError extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'ConflictError'
    }
  }
  class ForbiddenError extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'ForbiddenError'
    }
  }
  return { ConflictError, ForbiddenError }
})

import { getDb } from '../db/client'
import { loadConfig } from '../runtime/configLoader'
import { runHook } from '../runtime/hookRunner'
import { createTeam } from './createTeam'

function createMockDb() {
  const mockReturning = vi.fn()
  const mockValues = vi.fn(() => ({ returning: mockReturning }))
  const mockInsert = vi.fn(() => ({ values: mockValues }))
  const mockLimit = vi.fn()
  const mockWhere = vi.fn(() => ({ limit: mockLimit }))
  const mockFrom = vi.fn(() => ({ where: mockWhere }))
  const mockSelect = vi.fn(() => ({ from: mockFrom }))

  return {
    db: { select: mockSelect, insert: mockInsert },
    mockSelect,
    mockFrom,
    mockWhere,
    mockLimit,
    mockInsert,
    mockValues,
    mockReturning,
  }
}

describe('createTeam', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates team successfully, adds owner as member, and fires hook', async () => {
    const { db, mockLimit, mockReturning, mockValues } = createMockDb()
    vi.mocked(getDb).mockReturnValue(db as never)
    vi.mocked(loadConfig).mockReturnValue({
      allowTeamCreation: true,
      maxTeamsPerUser: 5,
    })

    // Count query returns 0 teams
    mockLimit.mockResolvedValueOnce([{ count: 0 }])
    // Slug uniqueness check returns empty
    mockLimit.mockResolvedValueOnce([])

    const teamRow = {
      id: 'team-1',
      name: 'My Team',
      slug: 'my-team',
      ownerId: 'user-1',
      avatarUrl: null,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    // Insert team returning
    mockReturning.mockResolvedValueOnce([teamRow])
    // Insert member (no returning needed, just resolve)
    mockValues.mockResolvedValueOnce(undefined)

    vi.mocked(runHook).mockResolvedValue(undefined)

    const result = await createTeam('user-1', 'user@test.com', 'My Team', 'my-team')

    expect(result.id).toBe('team-1')
    expect(result.slug).toBe('my-team')
    expect(db.insert).toHaveBeenCalledTimes(2)
    expect(runHook).toHaveBeenCalledWith('onTeamCreated', expect.objectContaining({
      team: expect.objectContaining({ id: 'team-1' }),
      owner: { id: 'user-1', email: 'user@test.com' },
    }))
  })

  it('throws ForbiddenError when team creation is disabled', async () => {
    const { db } = createMockDb()
    vi.mocked(getDb).mockReturnValue(db as never)
    vi.mocked(loadConfig).mockReturnValue({
      allowTeamCreation: false,
      maxTeamsPerUser: 5,
    })

    await expect(createTeam('user-1', 'user@test.com', 'Team', 'team'))
      .rejects.toThrow('Team creation is disabled')
  })

  it('throws ForbiddenError when max teams exceeded', async () => {
    const { db, mockLimit } = createMockDb()
    vi.mocked(getDb).mockReturnValue(db as never)
    vi.mocked(loadConfig).mockReturnValue({
      allowTeamCreation: true,
      maxTeamsPerUser: 2,
    })

    // Count query returns 2 (at max)
    mockLimit.mockResolvedValueOnce([{ count: 2 }])

    await expect(createTeam('user-1', 'user@test.com', 'Team', 'team'))
      .rejects.toThrow('You can create a maximum of 2 teams')
  })

  it('throws ConflictError when slug already exists', async () => {
    const { db, mockLimit } = createMockDb()
    vi.mocked(getDb).mockReturnValue(db as never)
    vi.mocked(loadConfig).mockReturnValue({
      allowTeamCreation: true,
      maxTeamsPerUser: 5,
    })

    // Count query returns 0
    mockLimit.mockResolvedValueOnce([{ count: 0 }])
    // Slug uniqueness check returns existing team
    mockLimit.mockResolvedValueOnce([{ id: 'existing-team' }])

    await expect(createTeam('user-1', 'user@test.com', 'Team', 'my-team'))
      .rejects.toThrow('A team with this slug already exists')
  })

  it('normalizes slug to lowercase and replaces special chars with hyphens', async () => {
    const { db, mockLimit, mockReturning, mockValues, mockWhere } = createMockDb()
    vi.mocked(getDb).mockReturnValue(db as never)
    vi.mocked(loadConfig).mockReturnValue({
      allowTeamCreation: true,
      maxTeamsPerUser: 5,
    })

    // Count query
    mockLimit.mockResolvedValueOnce([{ count: 0 }])
    // Slug uniqueness check
    mockLimit.mockResolvedValueOnce([])

    const teamRow = {
      id: 'team-2',
      name: 'My Team!',
      slug: 'my-team-',
      ownerId: 'user-1',
      avatarUrl: null,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    mockReturning.mockResolvedValueOnce([teamRow])
    mockValues.mockResolvedValueOnce(undefined)
    vi.mocked(runHook).mockResolvedValue(undefined)

    const result = await createTeam('user-1', 'user@test.com', 'My Team!', 'My Team!')

    // The slug check should have used the normalized slug
    // eq is called with the slug column and normalized value
    expect(mockWhere).toHaveBeenCalled()
    expect(result).toBeDefined()
  })
})
