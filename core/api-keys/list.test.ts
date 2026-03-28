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

const mockLimit = vi.fn()
const mockOrderBy = vi.fn().mockReturnValue(mockRows)
const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy })

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

  it('returns keys excluding revoked by default', async () => {
    const keys = await listApiKeys('user-123')

    // Should filter out the revoked key (key-2)
    expect(keys).toHaveLength(1)
    expect(keys[0].id).toBe('key-1')
    expect(keys[0].name).toBe('Production')
    expect(keys[0].revokedAt).toBeNull()
  })

  it('includes revoked keys when requested', async () => {
    const keys = await listApiKeys('user-123', true)

    expect(keys).toHaveLength(2)
    expect(keys[1].revokedAt).not.toBeNull()
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
