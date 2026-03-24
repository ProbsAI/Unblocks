import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSelect = vi.fn()
const mockFrom = vi.fn()
const mockWhere = vi.fn()
const mockLimit = vi.fn()
const mockInsert = vi.fn()
const mockValues = vi.fn()
const mockUpdate = vi.fn()
const mockSet = vi.fn()
const mockUpdateWhere = vi.fn()

vi.mock('../db/client', () => ({
  getDb: vi.fn(() => ({
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
  })),
}))

vi.mock('../db/schema/users', () => ({
  users: {
    email: 'email',
  },
}))

vi.mock('../db/schema/verificationTokens', () => ({
  verificationTokens: {
    id: 'id',
    token: 'token',
    type: 'type',
    expiresAt: 'expiresAt',
    usedAt: 'usedAt',
  },
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ a, b })),
  and: vi.fn((...args: unknown[]) => args),
  gt: vi.fn((a, b) => ({ a, b })),
  isNull: vi.fn((a) => ({ isNull: a })),
}))

vi.mock('./token', () => ({
  generateRandomToken: vi.fn().mockReturnValue('verification-token-123'),
}))

import {
  createEmailVerificationToken,
  verifyEmail,
} from './emailVerification'
import { AuthError } from '../errors/types'

function setupSelectChain(result: unknown[]) {
  mockLimit.mockResolvedValue(result)
  mockWhere.mockReturnValue({ limit: mockLimit })
  mockFrom.mockReturnValue({ where: mockWhere })
  mockSelect.mockReturnValue({ from: mockFrom })
}

function setupInsertChain() {
  mockValues.mockResolvedValue(undefined)
  mockInsert.mockReturnValue({ values: mockValues })
}

function setupUpdateChain() {
  mockUpdateWhere.mockResolvedValue(undefined)
  mockSet.mockReturnValue({ where: mockUpdateWhere })
  mockUpdate.mockReturnValue({ set: mockSet })
}

beforeEach(() => {
  vi.clearAllMocks()
  setupUpdateChain()
})

describe('createEmailVerificationToken', () => {
  it('creates and returns a token', async () => {
    setupInsertChain()

    const token = await createEmailVerificationToken('test@example.com')

    expect(token).toBe('verification-token-123')
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        token: 'verification-token-123',
        email: 'test@example.com',
        type: 'email_verification',
      })
    )
  })

  it('lowercases email', async () => {
    setupInsertChain()

    await createEmailVerificationToken('TEST@EXAMPLE.COM')

    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'test@example.com' })
    )
  })

  it('sets expiration to 24 hours', async () => {
    setupInsertChain()

    await createEmailVerificationToken('test@example.com')

    const callArgs = mockValues.mock.calls[0][0]
    const expectedMin = Date.now() + 23.9 * 60 * 60 * 1000
    const expectedMax = Date.now() + 24.1 * 60 * 60 * 1000
    expect(callArgs.expiresAt.getTime()).toBeGreaterThan(expectedMin)
    expect(callArgs.expiresAt.getTime()).toBeLessThan(expectedMax)
  })
})

describe('verifyEmail', () => {
  it('verifies valid token and marks email as verified', async () => {
    const mockToken = {
      id: 'token-1',
      token: 'valid-token',
      email: 'test@example.com',
      type: 'email_verification',
    }
    setupSelectChain([mockToken])

    await verifyEmail('valid-token')

    // Should update token as used and update user email verification
    expect(mockUpdate).toHaveBeenCalledTimes(2)
  })

  it('throws AuthError for invalid token', async () => {
    setupSelectChain([])

    await expect(verifyEmail('bad-token')).rejects.toThrow(AuthError)
    await expect(verifyEmail('bad-token')).rejects.toThrow(
      'Invalid or expired verification link'
    )
  })

  it('marks token as used', async () => {
    const mockToken = {
      id: 'token-1',
      token: 'valid-token',
      email: 'test@example.com',
      type: 'email_verification',
    }
    setupSelectChain([mockToken])

    await verifyEmail('valid-token')

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ usedAt: expect.any(Date) })
    )
  })

  it('sets emailVerified and emailVerifiedAt on user', async () => {
    const mockToken = {
      id: 'token-1',
      token: 'valid-token',
      email: 'test@example.com',
      type: 'email_verification',
    }
    setupSelectChain([mockToken])

    await verifyEmail('valid-token')

    // Second update call should set emailVerified
    const secondSetCall = mockSet.mock.calls[1][0]
    expect(secondSetCall.emailVerified).toBe(true)
    expect(secondSetCall.emailVerifiedAt).toBeInstanceOf(Date)
  })
})
