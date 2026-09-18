import { describe, it, expect, vi, beforeEach } from 'vitest'

// verifyEmail no longer selects the token — it is claimed atomically — so the
// only select left in this module belongs to the getDb stub below.
const mockSelect = vi.fn()
const mockInsert = vi.fn()
const mockValues = vi.fn()
const mockUpdate = vi.fn()
const mockSet = vi.fn()
const mockUpdateWhere = vi.fn()

const { claimedTokenRow } = vi.hoisted(() => ({
  claimedTokenRow: { current: [] as unknown[] },
}))

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
    email: 'email',
    emailEncrypted: 'emailEncrypted',
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
  // Mirrors the real guard rather than stubbing it true: these suites exercise
  // the lookup paths, and the format check is now part of what they do.
  isWellFormedToken: vi.fn((value: string) => /^[0-9a-f]{64}$/.test(value)),
}))

vi.mock('../security/blindIndex', () => ({
  blindIndex: vi.fn((val: string) => `blind:${val}`),
  // Mock the whole module surface, not just the export this file
  // happens to reach today. blindIndex.ts exports three functions and a
  // partial mock fails only once the module under test starts using the
  // other one — which is how magicLink broke when emailHash moved to
  // a different derivation.
  blindIndexNullable: vi.fn((val: string | null | undefined) =>
    val == null ? null : `blind:${val}`
  ),
}))

vi.mock('../security/encryption', () => ({
  encrypt: vi.fn((val: string) => `enc:${val}`),
}))

import {
  createEmailVerificationToken,
  verifyEmail,
} from './emailVerification'
import { AuthError } from '../errors/types'

function setupInsertChain() {
  mockValues.mockResolvedValue(undefined)
  mockInsert.mockReturnValue({ values: mockValues })
}

function setupUpdateChain() {
  // Single-use tokens are now claimed with UPDATE ... RETURNING, so `where`
  // has to be both awaitable (the plain user updates) and carry `.returning()`
  // (the claim). A resolved promise with the method attached satisfies both.
  //
  // What this cannot check is the thing the claim exists for: that two
  // concurrent callers cannot both win it. That is a property of Postgres row
  // locking and lives in verificationTokens.integration.test.ts.
  mockUpdateWhere.mockImplementation(() =>
    Object.assign(Promise.resolve(undefined), {
      returning: vi.fn().mockResolvedValue(claimedTokenRow.current),
    })
  )
  mockSet.mockReturnValue({ where: mockUpdateWhere })
  mockUpdate.mockReturnValue({ set: mockSet })
}

beforeEach(() => {
  vi.clearAllMocks()
  setupUpdateChain()
})

// Tokens must now match the shape generateRandomToken emits — 64 hex chars —
// before anything derives a blind index from them, so these cases cannot use
// readable placeholders like 'valid-token'. See isWellFormedToken.
const VALID_TOKEN = 'a'.repeat(64)
const UNKNOWN_TOKEN = 'b'.repeat(64)

describe('createEmailVerificationToken', () => {
  it('creates and returns a token', async () => {
    setupInsertChain()

    const token = await createEmailVerificationToken('test@example.com')

    expect(token).toBe('verification-token-123')
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        token: 'blind:verification-token-123',
        tokenHash: 'blind:verification-token-123',
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
    claimedTokenRow.current = [mockToken]
    setupUpdateChain()

    await verifyEmail(VALID_TOKEN)

    // Should update token as used and update user email verification
    expect(mockUpdate).toHaveBeenCalledTimes(2)
  })

  it('throws AuthError for invalid token', async () => {
    // The atomic claim returns nothing: unknown, expired, or already used.
    claimedTokenRow.current = []
    setupUpdateChain()

    await expect(verifyEmail(UNKNOWN_TOKEN)).rejects.toThrow(AuthError)
    await expect(verifyEmail(UNKNOWN_TOKEN)).rejects.toThrow(
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
    claimedTokenRow.current = [mockToken]
    setupUpdateChain()

    await verifyEmail(VALID_TOKEN)

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
    claimedTokenRow.current = [mockToken]
    setupUpdateChain()

    await verifyEmail(VALID_TOKEN)

    // Second update call should set emailVerified
    const secondSetCall = mockSet.mock.calls[1][0]
    expect(secondSetCall.emailVerified).toBe(true)
    expect(secondSetCall.emailVerifiedAt).toBeInstanceOf(Date)
  })
})
