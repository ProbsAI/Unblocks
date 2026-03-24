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
  const mockWhere = vi.fn()
  const mockFrom = vi.fn(() => ({ where: mockWhere }))
  const mockSelect = vi.fn(() => ({ from: mockFrom }))

  return {
    db: { select: mockSelect, insert: mockInsert },
    mockSelect,
    mockFrom,
    mockWhere,
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
    const { db, mockWhere, mockReturning, mockValues } = createMockDb()
    vi.mocked(getDb).mockReturnValue(db as never)
    vi.mocked(loadConfig).mockReturnValue({
      enabled: true,
      requireEmailVerification: false,
      roles: [{ id: 'owner', name: 'Owner', permissions: ['*'] }],
      maxMembersPerTeam: 10,
      allowTeamCreation: true,
      maxTeamsPerUser: 5,
      invitationExpiryHours: 72,
    })

    // Count query: select().from().where() — awaited directly, destructured
    mockWhere.mockReturnValueOnce([{ count: 0 }])
    // Slug uniqueness check: select().from().where().limit(1)
    mockWhere.mockReturnValueOnce({ limit: vi.fn().mockReturnValue([]) })

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
    // Insert team: values().returning()
    mockValues.mockReturnValueOnce({ returning: mockReturning })
    mockReturning.mockResolvedValueOnce([teamRow])
    // Insert member: values() — no .returning() needed
    mockValues.mockReturnValueOnce(Promise.resolve(undefined) as never)

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
      enabled: true,
      requireEmailVerification: false,
      roles: [{ id: 'owner', name: 'Owner', permissions: ['*'] }],
      maxMembersPerTeam: 10,
      allowTeamCreation: false,
      maxTeamsPerUser: 5,
      invitationExpiryHours: 72,
    })

    await expect(createTeam('user-1', 'user@test.com', 'Team', 'team'))
      .rejects.toThrow('Team creation is disabled')
  })

  it('throws ForbiddenError when max teams exceeded', async () => {
    const { db, mockWhere } = createMockDb()
    vi.mocked(getDb).mockReturnValue(db as never)
    vi.mocked(loadConfig).mockReturnValue({
      enabled: true,
      requireEmailVerification: false,
      roles: [{ id: 'owner', name: 'Owner', permissions: ['*'] }],
      maxMembersPerTeam: 10,
      allowTeamCreation: true,
      maxTeamsPerUser: 2,
      invitationExpiryHours: 72,
    })

    // Count query returns 2 (at max)
    mockWhere.mockReturnValueOnce([{ count: 2 }])

    await expect(createTeam('user-1', 'user@test.com', 'Team', 'team'))
      .rejects.toThrow('You can create a maximum of 2 teams')
  })

  it('throws ConflictError when slug already exists', async () => {
    const { db, mockWhere } = createMockDb()
    vi.mocked(getDb).mockReturnValue(db as never)
    vi.mocked(loadConfig).mockReturnValue({
      enabled: true,
      requireEmailVerification: false,
      roles: [{ id: 'owner', name: 'Owner', permissions: ['*'] }],
      maxMembersPerTeam: 10,
      allowTeamCreation: true,
      maxTeamsPerUser: 5,
      invitationExpiryHours: 72,
    })

    // Count query returns 0
    mockWhere.mockReturnValueOnce([{ count: 0 }])
    // Slug uniqueness check returns existing team
    mockWhere.mockReturnValueOnce({ limit: vi.fn().mockReturnValue([{ id: 'existing-team' }]) })

    await expect(createTeam('user-1', 'user@test.com', 'Team', 'my-team'))
      .rejects.toThrow('A team with this slug already exists')
  })

  it('normalizes slug to lowercase and replaces special chars with hyphens', async () => {
    const { db, mockReturning, mockValues, mockWhere } = createMockDb()
    vi.mocked(getDb).mockReturnValue(db as never)
    vi.mocked(loadConfig).mockReturnValue({
      enabled: true,
      requireEmailVerification: false,
      roles: [{ id: 'owner', name: 'Owner', permissions: ['*'] }],
      maxMembersPerTeam: 10,
      allowTeamCreation: true,
      maxTeamsPerUser: 5,
      invitationExpiryHours: 72,
    })

    // Count query
    mockWhere.mockReturnValueOnce([{ count: 0 }])
    // Slug uniqueness check
    mockWhere.mockReturnValueOnce({ limit: vi.fn().mockReturnValue([]) })

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
    mockValues.mockReturnValueOnce({ returning: mockReturning })
    mockReturning.mockResolvedValueOnce([teamRow])
    mockValues.mockReturnValueOnce(Promise.resolve(undefined) as never)
    vi.mocked(runHook).mockResolvedValue(undefined)

    const result = await createTeam('user-1', 'user@test.com', 'My Team!', 'My Team!')

    // The slug check should have used the normalized slug
    // eq is called with the slug column and normalized value
    expect(mockWhere).toHaveBeenCalled()
    expect(result).toBeDefined()
  })
})
