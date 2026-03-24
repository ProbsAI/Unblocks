import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSelect = vi.fn()
const mockFrom = vi.fn()
const mockWhere = vi.fn()
const mockLimit = vi.fn()

vi.mock('../db/client', () => ({
  getDb: vi.fn(() => ({
    select: mockSelect,
  })),
}))

vi.mock('../db/schema/sessions', () => ({
  sessions: {
    token: 'token',
    expiresAt: 'expiresAt',
    userId: 'userId',
  },
}))

vi.mock('../db/schema/users', () => ({
  users: {
    id: 'id',
  },
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ a, b })),
  and: vi.fn((...args: unknown[]) => args),
  gt: vi.fn((a, b) => ({ a, b })),
}))

vi.mock('./token', () => ({
  verifyToken: vi.fn(),
}))

import { validateSession } from './validateSession'
import { verifyToken } from './token'

const mockVerifyToken = vi.mocked(verifyToken)

const mockDbUser = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test',
  avatarUrl: null,
  emailVerified: true,
  status: 'active',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
}

const mockDbSession = {
  id: 'session-1',
  userId: 'user-1',
  token: 'valid-jwt',
  expiresAt: new Date('2025-01-01'),
}

// We need two separate query chains for sessions and users
let queryCallCount = 0

function setupSessionAndUserChains(
  sessionResult: unknown[],
  userResult: unknown[]
) {
  queryCallCount = 0
  mockLimit.mockImplementation(() => {
    queryCallCount++
    if (queryCallCount === 1) return Promise.resolve(sessionResult)
    return Promise.resolve(userResult)
  })
  mockWhere.mockReturnValue({ limit: mockLimit })
  mockFrom.mockReturnValue({ where: mockWhere })
  mockSelect.mockReturnValue({ from: mockFrom })
}

beforeEach(() => {
  vi.clearAllMocks()
  queryCallCount = 0
})

describe('validateSession', () => {
  it('returns validated session for valid token', async () => {
    mockVerifyToken.mockResolvedValue({
      userId: 'user-1',
      sessionId: 'session-1',
      type: 'session',
    })
    setupSessionAndUserChains([mockDbSession], [mockDbUser])

    const result = await validateSession('valid-jwt')

    expect(result).not.toBeNull()
    expect(result!.user.id).toBe('user-1')
    expect(result!.user.email).toBe('test@example.com')
    expect(result!.sessionId).toBe('session-1')
  })

  it('returns null when JWT is invalid', async () => {
    mockVerifyToken.mockResolvedValue(null)

    const result = await validateSession('invalid-jwt')

    expect(result).toBeNull()
  })

  it('returns null when token type is not session', async () => {
    mockVerifyToken.mockResolvedValue({
      userId: 'user-1',
      sessionId: 'session-1',
      type: 'email_verification',
    })

    const result = await validateSession('wrong-type-jwt')

    expect(result).toBeNull()
  })

  it('returns null when session not found in DB', async () => {
    mockVerifyToken.mockResolvedValue({
      userId: 'user-1',
      sessionId: 'session-1',
      type: 'session',
    })
    setupSessionAndUserChains([], [])

    const result = await validateSession('valid-jwt')

    expect(result).toBeNull()
  })

  it('returns null when user not found', async () => {
    mockVerifyToken.mockResolvedValue({
      userId: 'user-1',
      sessionId: 'session-1',
      type: 'session',
    })
    setupSessionAndUserChains([mockDbSession], [])

    const result = await validateSession('valid-jwt')

    expect(result).toBeNull()
  })

  it('returns null when user status is not active', async () => {
    mockVerifyToken.mockResolvedValue({
      userId: 'user-1',
      sessionId: 'session-1',
      type: 'session',
    })
    setupSessionAndUserChains(
      [mockDbSession],
      [{ ...mockDbUser, status: 'suspended' }]
    )

    const result = await validateSession('valid-jwt')

    expect(result).toBeNull()
  })
})
