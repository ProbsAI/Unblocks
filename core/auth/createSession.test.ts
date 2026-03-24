import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockInsert = vi.fn()
const mockValues = vi.fn()
const mockReturning = vi.fn()

vi.mock('../db/client', () => ({
  getDb: vi.fn(() => ({
    insert: mockInsert,
  })),
}))

vi.mock('../db/schema/sessions', () => ({
  sessions: { table: 'sessions' },
}))

vi.mock('./token', () => ({
  createToken: vi.fn().mockResolvedValue('jwt-token-123'),
  generateRandomToken: vi.fn().mockReturnValue('abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'),
}))

import { createSession } from './createSession'
import { createToken, generateRandomToken } from './token'

const mockCreateToken = vi.mocked(createToken)
const mockGenerateRandomToken = vi.mocked(generateRandomToken)

const mockSession = {
  id: 'session-1',
  userId: 'user-1',
  token: 'jwt-token-123',
  expiresAt: new Date('2024-01-08'),
  ipAddress: '127.0.0.1',
  userAgent: 'Mozilla/5.0',
  createdAt: new Date('2024-01-01'),
}

function setupInsertChain() {
  mockReturning.mockResolvedValue([mockSession])
  mockValues.mockReturnValue({ returning: mockReturning })
  mockInsert.mockReturnValue({ values: mockValues })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('createSession', () => {
  it('creates a session with a JWT token', async () => {
    setupInsertChain()

    const result = await createSession('user-1')

    expect(result.id).toBe('session-1')
    expect(result.userId).toBe('user-1')
    expect(result.token).toBe('jwt-token-123')
    expect(mockCreateToken).toHaveBeenCalledWith(
      { userId: 'user-1', sessionId: expect.any(String), type: 'session' },
      '7d'
    )
  })

  it('passes ipAddress and userAgent when provided', async () => {
    setupInsertChain()

    await createSession('user-1', {
      ipAddress: '192.168.1.1',
      userAgent: 'TestAgent/1.0',
    })

    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        ipAddress: '192.168.1.1',
        userAgent: 'TestAgent/1.0',
      })
    )
  })

  it('defaults ipAddress and userAgent to null', async () => {
    setupInsertChain()

    await createSession('user-1')

    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        ipAddress: null,
        userAgent: null,
      })
    )
  })

  it('generates a random session ID from token', async () => {
    setupInsertChain()

    await createSession('user-1')

    expect(mockGenerateRandomToken).toHaveBeenCalled()
  })

  it('sets expiration to 7 days from now', async () => {
    setupInsertChain()

    await createSession('user-1')

    const callArgs = mockValues.mock.calls[0][0]
    const expectedMin = Date.now() + 6.9 * 24 * 60 * 60 * 1000
    const expectedMax = Date.now() + 7.1 * 24 * 60 * 60 * 1000
    expect(callArgs.expiresAt.getTime()).toBeGreaterThan(expectedMin)
    expect(callArgs.expiresAt.getTime()).toBeLessThan(expectedMax)
  })
})
