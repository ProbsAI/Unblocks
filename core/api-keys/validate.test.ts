import { describe, it, expect, vi, beforeAll } from 'vitest'

beforeAll(() => {
  process.env.ENCRYPTION_KEY = 'a'.repeat(64)
  process.env.BLIND_INDEX_KEY = 'b'.repeat(64)
})

const mockUpdate = vi.fn().mockReturnValue({
  set: vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      then: vi.fn(),
    }),
  }),
})

vi.mock('../db/client', () => ({
  getDb: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{
            id: 'key-uuid-123',
            userId: 'user-123',
            teamId: null,
            scopes: ['*'],
            expiresAt: null,
            revokedAt: null,
          }]),
        }),
      }),
    }),
    update: mockUpdate,
  }),
}))

import { validateApiKey, isApiKey } from './validate'

describe('isApiKey', () => {
  it('returns true for valid API key format', () => {
    expect(isApiKey('ub_live_abc123')).toBe(true)
  })

  it('returns false for non-API key strings', () => {
    expect(isApiKey('sk-abc123')).toBe(false)
    expect(isApiKey('Bearer token')).toBe(false)
    expect(isApiKey('')).toBe(false)
  })
})

describe('validateApiKey', () => {
  it('returns invalid for keys with wrong prefix', async () => {
    const result = await validateApiKey('sk-wrong-prefix')
    expect(result.valid).toBe(false)
    expect(result.userId).toBeNull()
  })

  it('returns valid result for a matching key', async () => {
    const result = await validateApiKey('ub_live_' + 'a'.repeat(64))
    expect(result.valid).toBe(true)
    expect(result.userId).toBe('user-123')
    expect(result.scopes).toEqual(['*'])
  })
})
