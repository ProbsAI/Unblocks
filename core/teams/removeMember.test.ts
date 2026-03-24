import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../db/client', () => ({ getDb: vi.fn() }))
vi.mock('../db/schema/teams', () => ({
  teams: { id: 'id', slug: 'slug', ownerId: 'ownerId' },
  teamMembers: { id: 'id', teamId: 'teamId', userId: 'userId', role: 'role', joinedAt: 'joinedAt' },
  teamInvitations: { id: 'id', teamId: 'teamId', email: 'email', role: 'role', token: 'token', expiresAt: 'expiresAt', acceptedAt: 'acceptedAt', createdAt: 'createdAt', invitedBy: 'invitedBy' },
}))
vi.mock('drizzle-orm', () => ({ eq: vi.fn((a, b) => ({ a, b })), and: vi.fn((...a) => a), sql: vi.fn() }))
vi.mock('../runtime/hookRunner', () => ({
  runHook: vi.fn(),
}))
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
import { runHook } from '../runtime/hookRunner'
import { getUserTeamRole } from './getTeam'
import { removeMember, leaveTeam } from './removeMember'

function createMockDb() {
  const mockDeleteWhere = vi.fn().mockResolvedValue(undefined)
  const mockDelete = vi.fn(() => ({ where: mockDeleteWhere }))
  const mockLimit = vi.fn()
  const mockWhere = vi.fn(() => ({ limit: mockLimit }))
  const mockFrom = vi.fn(() => ({ where: mockWhere }))
  const mockSelect = vi.fn(() => ({ from: mockFrom }))

  return { db: { select: mockSelect, delete: mockDelete }, mockSelect, mockFrom, mockWhere, mockLimit, mockDelete, mockDeleteWhere }
}

describe('removeMember', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('removes member successfully and fires hook', async () => {
    const { db, mockDeleteWhere } = createMockDb()
    vi.mocked(getDb).mockReturnValue(db as never)
    vi.mocked(getUserTeamRole)
      .mockResolvedValueOnce('owner')   // remover role
      .mockResolvedValueOnce('member')  // target role
    vi.mocked(runHook).mockResolvedValue(undefined)
    mockDeleteWhere.mockResolvedValueOnce(undefined)

    await removeMember('team-1', 'user-2', 'user-1')

    expect(db.delete).toHaveBeenCalled()
    expect(runHook).toHaveBeenCalledWith('onTeamMemberRemoved', {
      teamId: 'team-1',
      userId: 'user-2',
      removedBy: 'user-1',
    })
  })

  it('throws ForbiddenError when not authorized', async () => {
    const { db } = createMockDb()
    vi.mocked(getDb).mockReturnValue(db as never)
    vi.mocked(getUserTeamRole).mockResolvedValueOnce('member')

    await expect(removeMember('team-1', 'user-2', 'user-3'))
      .rejects.toThrow('Not authorized to remove members')
  })

  it('throws NotFoundError when target is not a member', async () => {
    const { db } = createMockDb()
    vi.mocked(getDb).mockReturnValue(db as never)
    vi.mocked(getUserTeamRole)
      .mockResolvedValueOnce('owner')  // remover role
      .mockResolvedValueOnce(null)     // target not found

    await expect(removeMember('team-1', 'user-2', 'user-1'))
      .rejects.toThrow('User is not a member of this team')
  })

  it('throws ForbiddenError when trying to remove the owner', async () => {
    const { db } = createMockDb()
    vi.mocked(getDb).mockReturnValue(db as never)
    vi.mocked(getUserTeamRole)
      .mockResolvedValueOnce('owner')  // remover role (self)
      .mockResolvedValueOnce('owner')  // target is also owner

    await expect(removeMember('team-1', 'user-1', 'user-1'))
      .rejects.toThrow('Cannot remove the team owner')
  })

  it('throws ForbiddenError when admin tries to remove another admin', async () => {
    const { db } = createMockDb()
    vi.mocked(getDb).mockReturnValue(db as never)
    vi.mocked(getUserTeamRole)
      .mockResolvedValueOnce('admin')  // remover role
      .mockResolvedValueOnce('admin')  // target role

    await expect(removeMember('team-1', 'user-2', 'user-3'))
      .rejects.toThrow('Admins cannot remove other admins')
  })
})

describe('leaveTeam', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('leaves team successfully', async () => {
    const { db, mockLimit, mockDeleteWhere } = createMockDb()
    vi.mocked(getDb).mockReturnValue(db as never)

    // Team lookup returns team where user is not owner
    mockLimit.mockResolvedValueOnce([{ ownerId: 'other-user' }])
    mockDeleteWhere.mockResolvedValueOnce(undefined)

    await leaveTeam('team-1', 'user-2')

    expect(db.delete).toHaveBeenCalled()
  })

  it('throws ForbiddenError when owner tries to leave', async () => {
    const { db, mockLimit } = createMockDb()
    vi.mocked(getDb).mockReturnValue(db as never)

    mockLimit.mockResolvedValueOnce([{ ownerId: 'user-1' }])

    await expect(leaveTeam('team-1', 'user-1'))
      .rejects.toThrow('Owner cannot leave the team. Transfer ownership first.')
  })

  it('throws NotFoundError when team not found', async () => {
    const { db, mockLimit } = createMockDb()
    vi.mocked(getDb).mockReturnValue(db as never)

    mockLimit.mockResolvedValueOnce([])

    await expect(leaveTeam('nonexistent', 'user-1'))
      .rejects.toThrow('Team not found')
  })
})
