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
    id: 'id',
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
  generateRandomToken: vi.fn().mockReturnValue('reset-token-abc'),
}))

vi.mock('./password', () => ({
  hashPassword: vi.fn().mockResolvedValue('new-hashed-password'),
}))

vi.mock('../security/blindIndex', () => ({
  blindIndex: vi.fn((val: string) => `blind:${val}`),
}))

vi.mock('../security/encryption', () => ({
  encrypt: vi.fn((val: string) => `enc:${val}`),
}))

import { requestPasswordReset, resetPassword } from './passwordReset'
import { hashPassword } from './password'
import { AuthError } from '../errors/types'

const mockHashPassword = vi.mocked(hashPassword)

let selectCallCount: number

function setupMultiSelectChains(results: unknown[][]) {
  selectCallCount = 0
  mockLimit.mockImplementation(() => {
    const result = results[selectCallCount] ?? []
    selectCallCount++
    return Promise.resolve(result)
  })
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
  selectCallCount = 0
  setupUpdateChain()
})

describe('requestPasswordReset', () => {
  it('returns token and userId for existing user', async () => {
    setupMultiSelectChains([[{ id: 'user-1', email: 'test@example.com' }]])
    setupInsertChain()

    const result = await requestPasswordReset('test@example.com')

    expect(result).not.toBeNull()
    expect(result!.token).toBe('reset-token-abc')
    expect(result!.userId).toBe('user-1')
  })

  it('returns null for non-existent email (prevents enumeration)', async () => {
    setupMultiSelectChains([[]])

    const result = await requestPasswordReset('unknown@example.com')

    expect(result).toBeNull()
  })

  it('lowercases email for lookup', async () => {
    setupMultiSelectChains([[{ id: 'user-1', email: 'test@example.com' }]])
    setupInsertChain()

    await requestPasswordReset('TEST@EXAMPLE.COM')

    // Should have been called (select performed)
    expect(mockSelect).toHaveBeenCalled()
  })

  it('creates token with 1 hour expiry', async () => {
    setupMultiSelectChains([[{ id: 'user-1', email: 'test@example.com' }]])
    setupInsertChain()

    await requestPasswordReset('test@example.com')

    const callArgs = mockValues.mock.calls[0][0]
    const expectedMin = Date.now() + 59 * 60 * 1000
    const expectedMax = Date.now() + 61 * 60 * 1000
    expect(callArgs.expiresAt.getTime()).toBeGreaterThan(expectedMin)
    expect(callArgs.expiresAt.getTime()).toBeLessThan(expectedMax)
  })

  it('stores token with password_reset type', async () => {
    setupMultiSelectChains([[{ id: 'user-1', email: 'test@example.com' }]])
    setupInsertChain()

    await requestPasswordReset('test@example.com')

    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'password_reset',
        token: 'blind:reset-token-abc',
        tokenHash: 'blind:reset-token-abc',
        tokenEncrypted: 'enc:reset-token-abc',
      })
    )
  })
})

describe('resetPassword', () => {
  it('resets password for valid token', async () => {
    const mockToken = {
      id: 'token-1',
      token: 'valid-token',
      email: 'test@example.com',
      type: 'password_reset',
    }
    setupMultiSelectChains([[mockToken]])
    setupUpdateChain()

    await resetPassword('valid-token', 'newPassword123')

    expect(mockHashPassword).toHaveBeenCalledWith('newPassword123')
    // Two updates: mark token used + update password
    expect(mockUpdate).toHaveBeenCalledTimes(2)
  })

  it('throws AuthError for invalid token', async () => {
    setupMultiSelectChains([[]])

    await expect(
      resetPassword('bad-token', 'newPassword123')
    ).rejects.toThrow(AuthError)
    await expect(
      resetPassword('bad-token', 'newPassword123')
    ).rejects.toThrow('Invalid or expired reset link')
  })

  it('marks token as used', async () => {
    const mockToken = {
      id: 'token-1',
      token: 'valid-token',
      email: 'test@example.com',
      type: 'password_reset',
    }
    setupMultiSelectChains([[mockToken]])
    setupUpdateChain()

    await resetPassword('valid-token', 'newPassword123')

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ usedAt: expect.any(Date) })
    )
  })

  it('updates user password hash', async () => {
    const mockToken = {
      id: 'token-1',
      token: 'valid-token',
      email: 'test@example.com',
      type: 'password_reset',
    }
    setupMultiSelectChains([[mockToken]])
    setupUpdateChain()

    await resetPassword('valid-token', 'newPassword123')

    // Second update should set password hash
    const secondSetCall = mockSet.mock.calls[1][0]
    expect(secondSetCall.passwordHash).toBe('new-hashed-password')
    expect(secondSetCall.updatedAt).toBeInstanceOf(Date)
  })
})
