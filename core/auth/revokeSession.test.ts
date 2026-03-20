import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockDelete = vi.fn()
const mockWhere = vi.fn()

vi.mock('../db/client', () => ({
  getDb: vi.fn(() => ({
    delete: mockDelete,
  })),
}))

vi.mock('../db/schema/sessions', () => ({
  sessions: {
    id: 'id',
    token: 'token',
    userId: 'userId',
  },
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ a, b })),
}))

import {
  revokeSession,
  revokeSessionByToken,
  revokeAllSessions,
} from './revokeSession'

beforeEach(() => {
  vi.clearAllMocks()
  mockWhere.mockResolvedValue(undefined)
  mockDelete.mockReturnValue({ where: mockWhere })
})

describe('revokeSession', () => {
  it('deletes session by ID', async () => {
    await revokeSession('session-123')

    expect(mockDelete).toHaveBeenCalled()
    expect(mockWhere).toHaveBeenCalled()
  })
})

describe('revokeSessionByToken', () => {
  it('deletes session by token', async () => {
    await revokeSessionByToken('jwt-token-abc')

    expect(mockDelete).toHaveBeenCalled()
    expect(mockWhere).toHaveBeenCalled()
  })
})

describe('revokeAllSessions', () => {
  it('deletes all sessions for a user', async () => {
    await revokeAllSessions('user-1')

    expect(mockDelete).toHaveBeenCalled()
    expect(mockWhere).toHaveBeenCalled()
  })
})
