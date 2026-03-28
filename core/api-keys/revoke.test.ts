import { describe, it, expect, vi, beforeAll } from 'vitest'

beforeAll(() => {
  process.env.ENCRYPTION_KEY = 'a'.repeat(64)
})

const mockUpdate = vi.fn().mockReturnValue({
  set: vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue(undefined),
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
          }]),
        }),
      }),
    }),
    update: mockUpdate,
  }),
}))

import { revokeApiKey } from './revoke'

describe('revokeApiKey', () => {
  it('revokes a key owned by the user', async () => {
    await expect(revokeApiKey('key-uuid-123', 'user-123')).resolves.toBeUndefined()
    expect(mockUpdate).toHaveBeenCalled()
  })

  it('throws ForbiddenError when user does not own the key', async () => {
    await expect(revokeApiKey('key-uuid-123', 'other-user')).rejects.toThrow(
      "Cannot revoke another user's API key"
    )
  })

  it('throws NotFoundError when key does not exist', async () => {
    // Override mock to return empty result for this test
    const { getDb } = await import('../db/client')
    const mockDb = (getDb as ReturnType<typeof vi.fn>)()
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    })

    await expect(revokeApiKey('nonexistent-id', 'user-123')).rejects.toThrow(
      'API key not found'
    )
  })
})
