import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../db/client', () => ({ getDb: vi.fn() }))
vi.mock('../db/schema/teams', () => ({
  teams: { id: 'id', slug: 'slug', ownerId: 'ownerId' },
  teamMembers: { id: 'id', teamId: 'teamId', userId: 'userId', role: 'role', joinedAt: 'joinedAt' },
  teamInvitations: { id: 'id', teamId: 'teamId', email: 'email', role: 'role', token: 'token', expiresAt: 'expiresAt', acceptedAt: 'acceptedAt', createdAt: 'createdAt', invitedBy: 'invitedBy' },
}))
vi.mock('drizzle-orm', () => ({ eq: vi.fn((a, b) => ({ a, b })), and: vi.fn((...a) => a), sql: vi.fn() }))
vi.mock('./getTeam', () => ({
  getUserTeamRole: vi.fn(),
}))
vi.mock('../errors/types', () => {
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
  return { ForbiddenError, NotFoundError }
})

import { getDb } from '../db/client'
import { getUserTeamRole } from './getTeam'
import { updateMemberRole, transferOwnership } from './updateRole'

function createMockDb() {
  const mockUpdateWhere = vi.fn().mockResolvedValue(undefined)
  const mockSet = vi.fn(() => ({ where: mockUpdateWhere }))
  const mockUpdate = vi.fn(() => ({ set: mockSet }))
  const mockLimit = vi.fn()
  const mockWhere = vi.fn(() => ({ limit: mockLimit }))
  const mockFrom = vi.fn(() => ({ where: mockWhere }))
  const mockSelect = vi.fn(() => ({ from: mockFrom }))

  return { db: { select: mockSelect, update: mockUpdate }, mockSelect, mockFrom, mockWhere, mockLimit, mockUpdate, mockSet, mockUpdateWhere }
}

describe('updateMemberRole', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('updates member role successfully', async () => {
    const { db, mockUpdateWhere } = createMockDb()
    vi.mocked(getDb).mockReturnValue(db as never)
    vi.mocked(getUserTeamRole)
      .mockResolvedValueOnce('owner')   // updater is owner
      .mockResolvedValueOnce('member')  // target is member
    mockUpdateWhere.mockResolvedValueOnce(undefined)

    await updateMemberRole('team-1', 'user-2', 'admin', 'user-1')

    expect(db.update).toHaveBeenCalled()
  })

  it('throws ForbiddenError when not owner', async () => {
    const { db } = createMockDb()
    vi.mocked(getDb).mockReturnValue(db as never)
    vi.mocked(getUserTeamRole).mockResolvedValueOnce('admin')

    await expect(updateMemberRole('team-1', 'user-2', 'admin', 'user-3'))
      .rejects.toThrow('Only the team owner can change roles')
  })

  it('throws ForbiddenError when changing own role', async () => {
    const { db } = createMockDb()
    vi.mocked(getDb).mockReturnValue(db as never)
    vi.mocked(getUserTeamRole).mockResolvedValueOnce('owner')

    await expect(updateMemberRole('team-1', 'user-1', 'admin', 'user-1'))
      .rejects.toThrow('Cannot change your own role')
  })

  it('throws ForbiddenError when assigning owner role', async () => {
    const { db } = createMockDb()
    vi.mocked(getDb).mockReturnValue(db as never)
    vi.mocked(getUserTeamRole).mockResolvedValueOnce('owner')

    await expect(updateMemberRole('team-1', 'user-2', 'owner', 'user-1'))
      .rejects.toThrow('Use transferOwnership to transfer team ownership')
  })

  it('throws NotFoundError when target is not a member', async () => {
    const { db } = createMockDb()
    vi.mocked(getDb).mockReturnValue(db as never)
    vi.mocked(getUserTeamRole)
      .mockResolvedValueOnce('owner')  // updater
      .mockResolvedValueOnce(null)     // target not found

    await expect(updateMemberRole('team-1', 'user-2', 'admin', 'user-1'))
      .rejects.toThrow('User is not a member of this team')
  })
})

describe('transferOwnership', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('transfers ownership successfully', async () => {
    const { db, mockUpdateWhere } = createMockDb()
    vi.mocked(getDb).mockReturnValue(db as never)
    vi.mocked(getUserTeamRole)
      .mockResolvedValueOnce('owner')  // current owner
      .mockResolvedValueOnce('admin')  // new owner is a member
    mockUpdateWhere
      .mockResolvedValueOnce(undefined) // update teams
      .mockResolvedValueOnce(undefined) // update new owner role
      .mockResolvedValueOnce(undefined) // update old owner role

    await transferOwnership('team-1', 'user-2', 'user-1')

    // Should call update 3 times: team ownerId, new owner role, old owner role
    expect(db.update).toHaveBeenCalledTimes(3)
  })

  it('throws ForbiddenError when not owner', async () => {
    const { db } = createMockDb()
    vi.mocked(getDb).mockReturnValue(db as never)
    vi.mocked(getUserTeamRole).mockResolvedValueOnce('admin')

    await expect(transferOwnership('team-1', 'user-2', 'user-3'))
      .rejects.toThrow('Only the team owner can transfer ownership')
  })

  it('throws NotFoundError when new owner is not a member', async () => {
    const { db } = createMockDb()
    vi.mocked(getDb).mockReturnValue(db as never)
    vi.mocked(getUserTeamRole)
      .mockResolvedValueOnce('owner')  // current owner
      .mockResolvedValueOnce(null)     // new owner not found

    await expect(transferOwnership('team-1', 'user-2', 'user-1'))
      .rejects.toThrow('User is not a member of this team')
  })
})
