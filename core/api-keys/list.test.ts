import { describe, it, expect, vi, beforeEach } from 'vitest'

const now = new Date('2026-03-01T00:00:00Z')

const mockRows = [
  {
    id: 'key-1',
    userId: 'user-123',
    teamId: null,
    name: 'Production',
    prefix: 'ub_live_abc12345',
    scopes: ['*'],
    lastUsedAt: new Date('2026-02-28'),
    expiresAt: null,
    revokedAt: null,
    createdAt: now,
  },
  {
    id: 'key-2',
    userId: 'user-123',
    teamId: 'team-1',
    name: 'Staging',
    prefix: 'ub_live_def67890',
    scopes: ['ai:read'],
    lastUsedAt: null,
    expiresAt: null,
    revokedAt: new Date('2026-02-15'),
    createdAt: new Date('2026-01-01'),
  },
]

// vi.mock factories are hoisted above every other statement in the file, so a
// factory that closes over a plain `const` hits the temporal dead zone and
// vitest reports "error when mocking a module". vi.hoisted lifts the mocks with
// it.
const { mockOrderBy, mockWhere } = vi.hoisted(() => {
  const orderBy = vi.fn()
  return {
    mockOrderBy: orderBy,
    // The parameter is declared so the recorded args tuple is typed
    // [unknown] rather than [], letting assertions read calls[0][0].
    mockWhere: vi.fn((_condition: unknown) => ({ orderBy })),
  }
})

vi.mock('../db/client', () => ({
  getDb: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: mockWhere,
        orderBy: mockOrderBy,
      }),
    }),
  }),
}))

import { listApiKeys } from './list'

describe('listApiKeys', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockOrderBy.mockReturnValue(mockRows)
  })

  // Revoked-key filtering is now a SQL predicate rather than a JavaScript
  // filter over the result set, so a mocked database cannot exercise it: the
  // mock returns whatever rows it is given regardless of the WHERE clause.
  // Asserting on it here would only re-test the mock. It belongs in an
  // integration test against a real Postgres.
  it('builds a narrower predicate when revoked keys are excluded', async () => {
    await listApiKeys('user-123')
    const defaultPredicate = mockWhere.mock.calls[0][0]

    vi.clearAllMocks()
    mockOrderBy.mockReturnValue(mockRows)

    await listApiKeys('user-123', true)
    const includeRevokedPredicate = mockWhere.mock.calls[0][0]

    expect(defaultPredicate).not.toEqual(includeRevokedPredicate)
  })

  it('returns every row the query yields', async () => {
    const keys = await listApiKeys('user-123', true)
    expect(keys).toHaveLength(mockRows.length)
  })

  it('maps fields correctly without exposing encrypted key', async () => {
    const keys = await listApiKeys('user-123')
    const key = keys[0]

    expect(key).toEqual({
      id: 'key-1',
      userId: 'user-123',
      teamId: null,
      name: 'Production',
      prefix: 'ub_live_abc12345',
      scopes: ['*'],
      lastUsedAt: expect.any(Date),
      expiresAt: null,
      revokedAt: null,
      createdAt: now,
    })

    // Ensure no sensitive fields leak
    expect(key).not.toHaveProperty('keyHash')
    expect(key).not.toHaveProperty('keyEncrypted')
  })

  it('returns empty array when user has no keys', async () => {
    mockOrderBy.mockReturnValue([])
    const keys = await listApiKeys('user-no-keys')
    expect(keys).toEqual([])
  })
})
