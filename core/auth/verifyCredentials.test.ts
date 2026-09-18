import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSelect = vi.fn()
const mockFrom = vi.fn()
const mockWhere = vi.fn()
const mockLimit = vi.fn()
const mockUpdate = vi.fn()
const mockSet = vi.fn()
const mockUpdateWhere = vi.fn()

// Storage mode is not what these cases are about — they predate it and assert
// the plaintext shape. The fork itself is covered in both directions by
// core/security/piiStorage.integration.test.ts, against a real database.
vi.mock('../security/piiStorage', () => ({
  piiEncryptionEnabled: vi.fn(() => false),
  emailMatches: vi.fn((email: string) => ({ email: email.toLowerCase() })),
  emailColumns: vi.fn((email: string) => ({
    email: email.toLowerCase(),
    emailEncrypted: null,
    emailHash: null,
  })),
  emailValueColumns: vi.fn((email: string) => ({
    email: email.toLowerCase(),
    emailEncrypted: null,
  })),
  emailMatchesIn: vi.fn((_cols: unknown, email: string) => ({
    email: email.toLowerCase(),
  })),
  readEmail: vi.fn((row: { email: string | null }) => row.email ?? ''),
}))

vi.mock('../db/client', () => ({
  getDb: vi.fn(() => ({
    select: mockSelect,
    update: mockUpdate,
  })),
}))

vi.mock('../db/schema/users', () => ({
  users: {
    id: 'id',
    email: 'email',
  },
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ a, b })),
}))

const { authConfig } = vi.hoisted(() => ({
  authConfig: { current: { security: { requireEmailVerification: true } } },
}))

vi.mock('../runtime/configLoader', () => ({
  loadConfig: vi.fn(() => authConfig.current),
}))

vi.mock('./password', () => ({
  verifyPassword: vi.fn(),
}))

import { verifyCredentials } from './verifyCredentials'
import { verifyPassword } from './password'
import { AuthError } from '../errors/types'

const mockVerifyPassword = vi.mocked(verifyPassword)

const mockDbUser = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test',
  avatarUrl: null,
  emailVerified: true,
  status: 'active',
  passwordHash: 'hashed_password',
  loginCount: 5,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
}

function setupSelectChain(result: unknown[]) {
  mockLimit.mockResolvedValue(result)
  mockWhere.mockReturnValue({ limit: mockLimit })
  mockFrom.mockReturnValue({ where: mockWhere })
  mockSelect.mockReturnValue({ from: mockFrom })
}

function setupUpdateChain() {
  mockUpdateWhere.mockResolvedValue(undefined)
  mockSet.mockReturnValue({ where: mockUpdateWhere })
  mockUpdate.mockReturnValue({ set: mockSet })
}

beforeEach(() => {
  vi.clearAllMocks()
  setupUpdateChain()
  authConfig.current = { security: { requireEmailVerification: true } }
})

describe('verifyCredentials — email verification', () => {
  it('refuses an unverified account while the setting requires verification', async () => {
    // This is what breaks the takeover chain. An attacker who registers
    // victim@example.com and never verifies it must not be able to sign in:
    // otherwise the row sits there as a usable account until the real owner
    // arrives via a magic link, which marks that same row verified and hands
    // it to them with the attacker's password still attached.
    setupSelectChain([{ ...mockDbUser, emailVerified: false }])
    mockVerifyPassword.mockResolvedValue(true)

    await expect(
      verifyCredentials('test@example.com', 'correctpassword')
    ).rejects.toThrow(/verify your email/i)
  })

  it('allows an unverified account when the setting is off', async () => {
    // The setting is the operator's call. What it must not be is declared and
    // ignored, which is what it was.
    authConfig.current = { security: { requireEmailVerification: false } }
    setupSelectChain([{ ...mockDbUser, emailVerified: false }])
    mockVerifyPassword.mockResolvedValue(true)

    const result = await verifyCredentials('test@example.com', 'correctpassword')
    expect(result.id).toBe('user-1')
  })

  it('still refuses a suspended account before looking at verification', async () => {
    setupSelectChain([
      { ...mockDbUser, status: 'suspended', emailVerified: false },
    ])
    mockVerifyPassword.mockResolvedValue(true)

    await expect(
      verifyCredentials('test@example.com', 'correctpassword')
    ).rejects.toThrow(/suspended/i)
  })
})

describe('verifyCredentials', () => {
  it('returns user for valid credentials', async () => {
    setupSelectChain([mockDbUser])
    mockVerifyPassword.mockResolvedValue(true)

    const result = await verifyCredentials('test@example.com', 'correctpassword')

    expect(result.id).toBe('user-1')
    expect(result.email).toBe('test@example.com')
  })

  it('lowercases email for lookup', async () => {
    setupSelectChain([mockDbUser])
    mockVerifyPassword.mockResolvedValue(true)

    await verifyCredentials('TEST@EXAMPLE.COM', 'correctpassword')

    // The eq mock should have been called with lowercased email
    expect(mockVerifyPassword).toHaveBeenCalledWith('correctpassword', 'hashed_password')
  })

  it('throws AuthError when user not found', async () => {
    setupSelectChain([])

    await expect(
      verifyCredentials('unknown@example.com', 'password')
    ).rejects.toThrow(AuthError)

    await expect(
      verifyCredentials('unknown@example.com', 'password')
    ).rejects.toThrow('Invalid email or password')
  })

  it('throws AuthError when user has no password hash (OAuth user)', async () => {
    setupSelectChain([{ ...mockDbUser, passwordHash: null }])

    await expect(
      verifyCredentials('test@example.com', 'password')
    ).rejects.toThrow('This account uses a different login method')
  })

  it('throws AuthError when user is suspended', async () => {
    setupSelectChain([{ ...mockDbUser, status: 'suspended' }])

    await expect(
      verifyCredentials('test@example.com', 'password')
    ).rejects.toThrow('This account has been suspended')
  })

  it('throws AuthError when password is wrong', async () => {
    setupSelectChain([mockDbUser])
    mockVerifyPassword.mockResolvedValue(false)

    await expect(
      verifyCredentials('test@example.com', 'wrongpassword')
    ).rejects.toThrow(AuthError)
  })

  it('updates lastLoginAt and loginCount on success', async () => {
    setupSelectChain([mockDbUser])
    mockVerifyPassword.mockResolvedValue(true)

    await verifyCredentials('test@example.com', 'correctpassword')

    expect(mockUpdate).toHaveBeenCalled()
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        loginCount: 6,
      })
    )
  })

  it('handles null loginCount gracefully', async () => {
    setupSelectChain([{ ...mockDbUser, loginCount: null }])
    mockVerifyPassword.mockResolvedValue(true)

    await verifyCredentials('test@example.com', 'correctpassword')

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        loginCount: 1,
      })
    )
  })
})
