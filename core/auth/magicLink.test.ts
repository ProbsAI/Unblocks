import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSelect = vi.fn()
const mockFrom = vi.fn()
const mockWhere = vi.fn()
const mockLimit = vi.fn()
const mockInsert = vi.fn()
const mockValues = vi.fn()
const mockReturning = vi.fn()
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
  generateRandomToken: vi.fn().mockReturnValue('random-token-abc123'),
  // Mirrors the real guard rather than stubbing it true: these suites exercise
  // the lookup paths, and the format check is now part of what they do.
  isWellFormedToken: vi.fn((value: string) => /^[0-9a-f]{64}$/.test(value)),
}))

vi.mock('../runtime/hookRunner', () => ({
  runHook: vi.fn().mockResolvedValue(undefined),
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

import { createMagicLink, verifyMagicLink } from './magicLink'
import { runHook } from '../runtime/hookRunner'
import { AuthError, NotFoundError } from '../errors/types'

const mockRunHook = vi.mocked(runHook)

const mockDbUser = {
  id: 'user-1',
  email: 'test@example.com',
  name: null,
  avatarUrl: null,
  emailVerified: false,
  status: 'active',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
}

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

function setupInsertChain(returnValue?: unknown[]) {
  if (returnValue) {
    mockReturning.mockResolvedValue(returnValue)
    mockValues.mockReturnValue({ returning: mockReturning })
  } else {
    mockValues.mockResolvedValue(undefined)
  }
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
  selectCallCount = 0
  setupUpdateChain()
})

// Tokens must now match the shape generateRandomToken emits — 64 hex chars —
// before anything derives a blind index from them, so these cases cannot use
// readable placeholders like 'valid-token'. See isWellFormedToken.
const VALID_TOKEN = 'a'.repeat(64)
const UNKNOWN_TOKEN = 'b'.repeat(64)

describe('createMagicLink', () => {
  it('returns token for existing user', async () => {
    setupMultiSelectChains([[mockDbUser]])
    setupInsertChain()

    const token = await createMagicLink('test@example.com')

    expect(token).toBe('random-token-abc123')
    // Should insert verification token
    expect(mockInsert).toHaveBeenCalled()
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        token: 'blind:random-token-abc123',
        tokenHash: 'blind:random-token-abc123',
        email: 'test@example.com',
        type: 'magic_link',
      })
    )
  })

  it('creates new user when email not found', async () => {
    setupMultiSelectChains([[]])
    // First insert: create user, second insert: create token
    let insertCount = 0
    mockInsert.mockImplementation(() => {
      insertCount++
      if (insertCount === 1) {
        // User creation
        return {
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([mockDbUser]),
          }),
        }
      }
      // Token creation
      return { values: vi.fn().mockResolvedValue(undefined) }
    })

    const token = await createMagicLink('new@example.com')

    expect(token).toBe('random-token-abc123')
    expect(mockRunHook).toHaveBeenCalledWith('onUserCreated', expect.objectContaining({
      method: 'magic_link',
    }))
  })

  it('lowercases email', async () => {
    setupMultiSelectChains([[mockDbUser]])
    setupInsertChain()

    await createMagicLink('TEST@EXAMPLE.COM')

    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'test@example.com' })
    )
  })
})

describe('verifyMagicLink', () => {
  it('returns user for valid token', async () => {
    const mockToken = {
      id: 'token-1',
      token: 'valid-token',
      email: 'test@example.com',
      type: 'magic_link',
      expiresAt: new Date('2025-01-01'),
      usedAt: null,
    }
    claimedTokenRow.current = [mockToken]
    setupMultiSelectChains([[mockDbUser]])
    setupUpdateChain()

    const result = await verifyMagicLink(VALID_TOKEN)

    expect(result.id).toBe('user-1')
    expect(result.emailVerified).toBe(true)
    // Should mark token as used
    expect(mockUpdate).toHaveBeenCalled()
  })

  it('throws AuthError for invalid token', async () => {
    // The claim returns nothing: unknown, expired, or already consumed.
    claimedTokenRow.current = []
    setupUpdateChain()

    await expect(verifyMagicLink(UNKNOWN_TOKEN)).rejects.toThrow(AuthError)
    await expect(verifyMagicLink(UNKNOWN_TOKEN)).rejects.toThrow(
      'Invalid or expired magic link'
    )
  })

  it('throws NotFoundError when user not found', async () => {
    const mockToken = {
      id: 'token-1',
      token: 'valid-token',
      email: 'deleted@example.com',
      type: 'magic_link',
      expiresAt: new Date('2025-01-01'),
      usedAt: null,
    }
    claimedTokenRow.current = [mockToken]
    setupMultiSelectChains([[]])
    setupUpdateChain()

    await expect(verifyMagicLink(VALID_TOKEN)).rejects.toThrow(NotFoundError)
  })

  it('updates email verification if not already verified', async () => {
    const mockToken = {
      id: 'token-1',
      token: 'valid-token',
      email: 'test@example.com',
      type: 'magic_link',
    }
    claimedTokenRow.current = [mockToken]
    setupMultiSelectChains([[{ ...mockDbUser, emailVerified: false }]])
    setupUpdateChain()

    await verifyMagicLink(VALID_TOKEN)

    // update called twice: mark token used + mark email verified
    expect(mockUpdate).toHaveBeenCalledTimes(2)
  })

  it('skips email verification update if already verified', async () => {
    const mockToken = {
      id: 'token-1',
      token: 'valid-token',
      email: 'test@example.com',
      type: 'magic_link',
    }
    claimedTokenRow.current = [mockToken]
    setupMultiSelectChains([[{ ...mockDbUser, emailVerified: true }]])
    setupUpdateChain()

    await verifyMagicLink(VALID_TOKEN)

    // update called once: mark token used only
    expect(mockUpdate).toHaveBeenCalledTimes(1)
  })
})
