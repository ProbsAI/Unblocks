import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../db/client', () => ({ getDb: vi.fn() }))
vi.mock('../db/schema/teams', () => ({
  teams: { id: 'id', slug: 'slug', ownerId: 'ownerId' },
  teamMembers: { id: 'id', teamId: 'teamId', userId: 'userId', role: 'role', joinedAt: 'joinedAt' },
  teamInvitations: { id: 'id', teamId: 'teamId', email: 'email', role: 'role', token: 'token', tokenHash: 'tokenHash', expiresAt: 'expiresAt', acceptedAt: 'acceptedAt', createdAt: 'createdAt', invitedBy: 'invitedBy' },
}))
vi.mock('drizzle-orm', () => ({ eq: vi.fn((a, b) => ({ a, b })), and: vi.fn((...a) => a), or: vi.fn((...a) => a), isNull: vi.fn((a) => ({ isNull: a })), sql: vi.fn() }))
vi.mock('../runtime/configLoader', () => ({
  loadConfig: vi.fn(),
}))
vi.mock('../runtime/hookRunner', () => ({
  runHook: vi.fn(),
}))
vi.mock('../security/encryption', () => ({
  encrypt: vi.fn((v: string) => `encrypted-${v}`),
}))
vi.mock('../security/blindIndex', () => ({
  blindIndex: vi.fn((v: string) => `blind-${v}`),
}))
vi.mock('./getTeam', () => ({
  getUserTeamRole: vi.fn(),
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
  class NotFoundError extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'NotFoundError'
    }
  }
  return { ConflictError, ForbiddenError, NotFoundError }
})

import { getDb } from '../db/client'
import { loadConfig } from '../runtime/configLoader'
import { runHook } from '../runtime/hookRunner'
import { getUserTeamRole } from './getTeam'
import { inviteMember, acceptInvitation, getTeamInvitations } from './inviteMember'

function createMockDb() {
  const mockReturning = vi.fn()
  const mockValues = vi.fn(() => ({ returning: mockReturning }))
  const mockInsert = vi.fn(() => ({ values: mockValues }))
  const mockSet = vi.fn()
  const mockUpdateWhere = vi.fn()
  const mockUpdate = vi.fn(() => ({ set: mockSet }))
  const mockLimit = vi.fn()
  const mockOrderBy = vi.fn()
  const mockWhere = vi.fn(() => ({ limit: mockLimit, orderBy: mockOrderBy }))
  const mockFrom = vi.fn(() => ({ where: mockWhere }))
  const mockSelect = vi.fn(() => ({ from: mockFrom }))
  const mockDelete = vi.fn(() => ({ where: vi.fn() }))

  mockSet.mockReturnValue({ where: mockUpdateWhere })

  return {
    db: { select: mockSelect, insert: mockInsert, update: mockUpdate, delete: mockDelete },
    mockSelect, mockFrom, mockWhere, mockLimit, mockInsert, mockValues, mockReturning,
    mockUpdate, mockSet, mockUpdateWhere, mockOrderBy,
  }
}

describe('inviteMember', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('successfully creates an invitation', async () => {
    const { db, mockLimit, mockReturning: _mockReturning } = createMockDb()
    vi.mocked(getDb).mockReturnValue(db as never)
    vi.mocked(getUserTeamRole).mockResolvedValueOnce('owner')
    vi.mocked(loadConfig).mockReturnValue({
      enabled: true,
      requireEmailVerification: false,
      roles: [{ id: 'owner', name: 'Owner', permissions: ['*'] }],
      maxMembersPerTeam: 10,
      maxTeamsPerUser: 5,
      allowTeamCreation: true,
      invitationExpiryHours: 72,
    })

    // Check current members count
    mockLimit.mockResolvedValueOnce([]) // existing invite check (with limit)

    // But first the members query (no limit) - need to handle the from->where chain without limit
    // Actually looking at code: members query has no limit, just .where()
    // So mockWhere returns { limit: mockLimit, orderBy: ... }
    // But members query doesn't call limit. It resolves the where directly.
    // We need mockWhere to resolve as a promise for the members query.
    // Let's restructure:

    // The mock chain: select->from->where returns { limit, orderBy }
    // For the members count query, the code does: db.select({id}).from(teamMembers).where(eq(...))
    // This returns the result of mockWhere which is { limit: mockLimit, orderBy: mockOrderBy }
    // That's not a promise... We need to handle this differently.

    // Let me rebuild the mock to handle both cases
    const mockLimit2 = vi.fn()
    const mockWhere2 = vi.fn()
    const mockFrom2 = vi.fn()
    const mockSelect2 = vi.fn()
    const mockReturning2 = vi.fn()
    const mockValues2 = vi.fn(() => ({ returning: mockReturning2 }))
    const mockInsert2 = vi.fn(() => ({ values: mockValues2 }))

    // Call 1: select members (no limit) -> returns array
    mockWhere2.mockResolvedValueOnce([{ id: 'mem-1' }])
    // Call 2: select existing invite (with limit)
    mockLimit2.mockResolvedValueOnce([])
    mockWhere2.mockReturnValueOnce({ limit: mockLimit2 })

    mockFrom2.mockReturnValue({ where: mockWhere2 })
    mockSelect2.mockReturnValue({ from: mockFrom2 })

    const invitationRow = {
      id: 'inv-1',
      teamId: 'team-1',
      email: 'new@test.com',
      role: 'member',
      invitedBy: 'user-1',
      token: 'some-token',
      expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
      acceptedAt: null,
      createdAt: new Date(),
    }
    mockReturning2.mockResolvedValueOnce([invitationRow])

    const db2 = { select: mockSelect2, insert: mockInsert2 }
    vi.mocked(getDb).mockReturnValue(db2 as never)

    const result = await inviteMember('team-1', 'new@test.com', 'member', 'user-1')
    expect(result.id).toBe('inv-1')
    expect(result.email).toBe('new@test.com')
    expect(mockInsert2).toHaveBeenCalled()
  })

  it('throws ForbiddenError when member role tries to invite', async () => {
    const { db } = createMockDb()
    vi.mocked(getDb).mockReturnValue(db as never)
    vi.mocked(getUserTeamRole).mockResolvedValueOnce('member')
    vi.mocked(loadConfig).mockReturnValue({
      enabled: true,
      requireEmailVerification: false,
      roles: [{ id: 'owner', name: 'Owner', permissions: ['*'] }],
      maxMembersPerTeam: 10,
      maxTeamsPerUser: 5,
      allowTeamCreation: true,
      invitationExpiryHours: 72,
    })

    await expect(inviteMember('team-1', 'new@test.com', 'member', 'user-1'))
      .rejects.toThrow('Not authorized to invite members')
  })

  it('throws ForbiddenError when trying to invite as owner', async () => {
    const { db } = createMockDb()
    vi.mocked(getDb).mockReturnValue(db as never)
    vi.mocked(getUserTeamRole).mockResolvedValueOnce('owner')
    vi.mocked(loadConfig).mockReturnValue({
      enabled: true,
      requireEmailVerification: false,
      roles: [{ id: 'owner', name: 'Owner', permissions: ['*'] }],
      maxMembersPerTeam: 10,
      maxTeamsPerUser: 5,
      allowTeamCreation: true,
      invitationExpiryHours: 72,
    })

    await expect(inviteMember('team-1', 'new@test.com', 'owner', 'user-1'))
      .rejects.toThrow('Cannot invite someone as owner')
  })

  it('throws ConflictError when user already invited', async () => {
    const mockWhere = vi.fn()
    const mockLimit = vi.fn()
    const mockFrom = vi.fn(() => ({ where: mockWhere }))
    const mockSelect = vi.fn(() => ({ from: mockFrom }))

    // Members query (no limit)
    mockWhere.mockResolvedValueOnce([{ id: 'mem-1' }])
    // Existing invite query (with limit)
    mockLimit.mockResolvedValueOnce([{ id: 'existing-inv' }])
    mockWhere.mockReturnValueOnce({ limit: mockLimit })

    const db = { select: mockSelect }
    vi.mocked(getDb).mockReturnValue(db as never)
    vi.mocked(getUserTeamRole).mockResolvedValueOnce('admin')
    vi.mocked(loadConfig).mockReturnValue({
      enabled: true,
      requireEmailVerification: false,
      roles: [{ id: 'owner', name: 'Owner', permissions: ['*'] }],
      maxMembersPerTeam: 10,
      maxTeamsPerUser: 5,
      allowTeamCreation: true,
      invitationExpiryHours: 72,
    })

    await expect(inviteMember('team-1', 'existing@test.com', 'member', 'user-1'))
      .rejects.toThrow('User has already been invited')
  })

  it('throws ForbiddenError when max members reached', async () => {
    const mockWhere = vi.fn()
    const mockFrom = vi.fn(() => ({ where: mockWhere }))
    const mockSelect = vi.fn(() => ({ from: mockFrom }))

    // Members query returns max members
    mockWhere.mockResolvedValueOnce([{ id: '1' }, { id: '2' }, { id: '3' }])

    const db = { select: mockSelect }
    vi.mocked(getDb).mockReturnValue(db as never)
    vi.mocked(getUserTeamRole).mockResolvedValueOnce('owner')
    vi.mocked(loadConfig).mockReturnValue({
      enabled: true,
      requireEmailVerification: false,
      roles: [{ id: 'owner', name: 'Owner', permissions: ['*'] }],
      maxMembersPerTeam: 3,
      maxTeamsPerUser: 5,
      allowTeamCreation: true,
      invitationExpiryHours: 72,
    })

    await expect(inviteMember('team-1', 'new@test.com', 'member', 'user-1'))
      .rejects.toThrow('Team has reached the maximum of 3 members')
  })
})

describe('acceptInvitation', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('accepts invitation successfully', async () => {
    const mockUpdateWhere = vi.fn().mockResolvedValueOnce(undefined)
    const mockSet = vi.fn(() => ({ where: mockUpdateWhere }))
    const mockUpdate = vi.fn(() => ({ set: mockSet }))
    const mockValues = vi.fn().mockResolvedValueOnce(undefined)
    const mockInsert = vi.fn(() => ({ values: mockValues }))
    const mockLimit = vi.fn()
    const mockWhere = vi.fn()
    const mockFrom = vi.fn(() => ({ where: mockWhere }))
    const mockSelect = vi.fn(() => ({ from: mockFrom }))

    const invitation = {
      id: 'inv-1',
      teamId: 'team-1',
      email: 'new@test.com',
      role: 'member',
      invitedBy: 'user-1',
      token: 'valid-token',
      expiresAt: new Date(Date.now() + 86400000),
      acceptedAt: null,
      createdAt: new Date(),
    }

    // Find invitation by token (with limit)
    mockLimit.mockResolvedValueOnce([invitation])
    mockWhere.mockReturnValueOnce({ limit: mockLimit })

    // Check if already a member (with limit)
    mockLimit.mockResolvedValueOnce([])
    mockWhere.mockReturnValueOnce({ limit: mockLimit })

    const db = { select: mockSelect, insert: mockInsert, update: mockUpdate }
    vi.mocked(getDb).mockReturnValue(db as never)
    vi.mocked(runHook).mockResolvedValue(undefined)

    await acceptInvitation('valid-token', 'user-2')

    expect(mockInsert).toHaveBeenCalled()
    expect(mockUpdate).toHaveBeenCalled()
    expect(runHook).toHaveBeenCalledWith('onTeamMemberAdded', expect.objectContaining({
      teamId: 'team-1',
      userId: 'user-2',
      role: 'member',
    }))
  })

  it('throws NotFoundError for invalid token', async () => {
    const mockLimit = vi.fn()
    const mockWhere = vi.fn(() => ({ limit: mockLimit }))
    const mockFrom = vi.fn(() => ({ where: mockWhere }))
    const mockSelect = vi.fn(() => ({ from: mockFrom }))

    mockLimit.mockResolvedValueOnce([])

    const db = { select: mockSelect }
    vi.mocked(getDb).mockReturnValue(db as never)

    await expect(acceptInvitation('bad-token', 'user-2'))
      .rejects.toThrow('Invitation not found')
  })

  it('throws ConflictError when invitation already accepted', async () => {
    const mockLimit = vi.fn()
    const mockWhere = vi.fn(() => ({ limit: mockLimit }))
    const mockFrom = vi.fn(() => ({ where: mockWhere }))
    const mockSelect = vi.fn(() => ({ from: mockFrom }))

    mockLimit.mockResolvedValueOnce([{
      id: 'inv-1',
      teamId: 'team-1',
      email: 'new@test.com',
      role: 'member',
      invitedBy: 'user-1',
      token: 'token',
      expiresAt: new Date(Date.now() + 86400000),
      acceptedAt: new Date(), // already accepted
      createdAt: new Date(),
    }])

    const db = { select: mockSelect }
    vi.mocked(getDb).mockReturnValue(db as never)

    await expect(acceptInvitation('token', 'user-2'))
      .rejects.toThrow('Invitation has already been accepted')
  })

  it('throws ForbiddenError when invitation expired', async () => {
    const mockLimit = vi.fn()
    const mockWhere = vi.fn(() => ({ limit: mockLimit }))
    const mockFrom = vi.fn(() => ({ where: mockWhere }))
    const mockSelect = vi.fn(() => ({ from: mockFrom }))

    mockLimit.mockResolvedValueOnce([{
      id: 'inv-1',
      teamId: 'team-1',
      email: 'new@test.com',
      role: 'member',
      invitedBy: 'user-1',
      token: 'token',
      expiresAt: new Date(Date.now() - 86400000), // expired
      acceptedAt: null,
      createdAt: new Date(),
    }])

    const db = { select: mockSelect }
    vi.mocked(getDb).mockReturnValue(db as never)

    await expect(acceptInvitation('token', 'user-2'))
      .rejects.toThrow('Invitation has expired')
  })

  it('throws ConflictError when already a member', async () => {
    const mockLimit = vi.fn()
    const mockWhere = vi.fn()
    const mockFrom = vi.fn(() => ({ where: mockWhere }))
    const mockSelect = vi.fn(() => ({ from: mockFrom }))

    // Find invitation
    mockLimit.mockResolvedValueOnce([{
      id: 'inv-1',
      teamId: 'team-1',
      email: 'new@test.com',
      role: 'member',
      invitedBy: 'user-1',
      token: 'token',
      expiresAt: new Date(Date.now() + 86400000),
      acceptedAt: null,
      createdAt: new Date(),
    }])
    mockWhere.mockReturnValueOnce({ limit: mockLimit })

    // Check existing member - found
    mockLimit.mockResolvedValueOnce([{ id: 'mem-1' }])
    mockWhere.mockReturnValueOnce({ limit: mockLimit })

    const db = { select: mockSelect }
    vi.mocked(getDb).mockReturnValue(db as never)

    await expect(acceptInvitation('token', 'user-2'))
      .rejects.toThrow('Already a member of this team')
  })
})

describe('getTeamInvitations', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns list of invitations', async () => {
    const mockOrderBy = vi.fn()
    const mockWhere = vi.fn(() => ({ orderBy: mockOrderBy }))
    const mockFrom = vi.fn(() => ({ where: mockWhere }))
    const mockSelect = vi.fn(() => ({ from: mockFrom }))

    const invitations = [
      {
        id: 'inv-1', teamId: 'team-1', email: 'a@test.com', role: 'member',
        invitedBy: 'user-1', token: 'tok1', expiresAt: new Date(),
        acceptedAt: null, createdAt: new Date(),
      },
    ]
    mockOrderBy.mockResolvedValueOnce(invitations)

    const db = { select: mockSelect }
    vi.mocked(getDb).mockReturnValue(db as never)

    const result = await getTeamInvitations('team-1')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('inv-1')
  })
})
