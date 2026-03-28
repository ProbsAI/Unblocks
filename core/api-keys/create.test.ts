import { describe, it, expect, vi, beforeAll } from 'vitest'

// Set required env vars before importing modules that need them
beforeAll(() => {
  process.env.ENCRYPTION_KEY = 'a'.repeat(64)
  process.env.BLIND_INDEX_KEY = 'b'.repeat(64)
})

// Mock the database
vi.mock('../db/client', () => ({
  getDb: vi.fn().mockReturnValue({
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{
          id: 'key-uuid-123',
          userId: 'user-123',
          teamId: null,
          name: 'Test Key',
          prefix: 'ub_live_abcdef12',
          keyHash: 'hash123',
          keyEncrypted: 'encrypted123',
          scopes: ['*'],
          lastUsedAt: null,
          expiresAt: null,
          revokedAt: null,
          createdAt: new Date(),
        }]),
      }),
    }),
  }),
}))

import { createApiKey } from './create'
import { API_KEY_PREFIX } from './types'

describe('createApiKey', () => {
  it('returns a key starting with the API key prefix', async () => {
    const result = await createApiKey('user-123', { name: 'Test Key' })

    expect(result.key).toMatch(new RegExp(`^${API_KEY_PREFIX}`))
  })

  it('returns key metadata without the full key', async () => {
    const result = await createApiKey('user-123', { name: 'My Key' })

    expect(result.apiKey.id).toBe('key-uuid-123')
    expect(result.apiKey.name).toBe('Test Key')
    expect(result.apiKey.prefix).toMatch(/^ub_live_/)
    expect(result.apiKey.scopes).toEqual(['*'])
  })

  it('generates unique keys each time', async () => {
    const result1 = await createApiKey('user-123', { name: 'Key 1' })
    const result2 = await createApiKey('user-123', { name: 'Key 2' })

    expect(result1.key).not.toBe(result2.key)
  })

  it('key prefix is shorter than the full key', async () => {
    const result = await createApiKey('user-123', { name: 'Test' })

    expect(result.apiKey.prefix.length).toBeLessThan(result.key.length)
    expect(result.key.startsWith(result.apiKey.prefix.slice(0, 8))).toBe(true)
  })
})
