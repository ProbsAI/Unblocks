import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../db/client', () => ({
  getDb: vi.fn(),
}))

vi.mock('../db/schema/users', () => ({
  users: {
    id: 'id',
    email: 'email',
    name: 'name',
    metadata: 'metadata',
    status: 'status',
    emailVerified: 'emailVerified',
    loginCount: 'loginCount',
    lastLoginAt: 'lastLoginAt',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
  },
}))

vi.mock('../db/schema/subscriptions', () => ({
  subscriptions: {
    id: 'id',
    userId: 'userId',
    plan: 'plan',
    status: 'status',
    interval: 'interval',
    currentPeriodEnd: 'currentPeriodEnd',
    cancelAtPeriodEnd: 'cancelAtPeriodEnd',
    createdAt: 'createdAt',
  },
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ _type: 'eq', a, b })),
  desc: vi.fn((col) => ({ _type: 'desc', col })),
  sql: vi.fn(),
  like: vi.fn((a, b) => ({ _type: 'like', a, b })),
  or: vi.fn((...args: unknown[]) => ({ _type: 'or', args })),
}))

vi.mock('../errors/types', () => ({
  ForbiddenError: class ForbiddenError extends Error {
    code = 'FORBIDDEN'
    statusCode = 403
    constructor(message: string) {
      super(message)
      this.name = 'ForbiddenError'
    }
  },
}))

import { getDb } from '../db/client'
import { requireAdmin, listUsers, updateUserStatus, setUserAdmin } from './users'

const mockGetDb = vi.mocked(getDb)

function createMockChain(): Record<string, ReturnType<typeof vi.fn>> {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain.select = vi.fn().mockReturnValue(chain)
  chain.from = vi.fn().mockReturnValue(chain)
  chain.where = vi.fn().mockReturnValue(chain)
  chain.limit = vi.fn().mockReturnValue(chain)
  chain.offset = vi.fn().mockReturnValue(chain)
  chain.orderBy = vi.fn().mockReturnValue(chain)
  chain.leftJoin = vi.fn().mockReturnValue(chain)
  chain.innerJoin = vi.fn().mockReturnValue(chain)
  chain.update = vi.fn().mockReturnValue(chain)
  chain.set = vi.fn().mockReturnValue(chain)
  // Make chain thenable to resolve as array by default
  chain.then = vi.fn((resolve) => resolve([]))
  return chain
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('requireAdmin', () => {
  it('succeeds when user has admin role', async () => {
    const chain = createMockChain()
    chain.limit = vi.fn().mockResolvedValue([{ metadata: { role: 'admin' } }])
    mockGetDb.mockReturnValue(chain as never)

    await expect(requireAdmin('user-1')).resolves.toBeUndefined()
  })

  it('throws ForbiddenError when user has no admin role', async () => {
    const chain = createMockChain()
    chain.limit = vi.fn().mockResolvedValue([{ metadata: { role: 'user' } }])
    mockGetDb.mockReturnValue(chain as never)

    await expect(requireAdmin('user-1')).rejects.toThrow('Admin access required')
  })

  it('throws ForbiddenError when user has no metadata', async () => {
    const chain = createMockChain()
    chain.limit = vi.fn().mockResolvedValue([{ metadata: null }])
    mockGetDb.mockReturnValue(chain as never)

    await expect(requireAdmin('user-1')).rejects.toThrow('Admin access required')
  })

  it('throws ForbiddenError when user not found', async () => {
    const chain = createMockChain()
    chain.limit = vi.fn().mockResolvedValue([])
    mockGetDb.mockReturnValue(chain as never)

    await expect(requireAdmin('nonexistent')).rejects.toThrow('Admin access required')
  })

  it('throws ForbiddenError when metadata has no role field', async () => {
    const chain = createMockChain()
    chain.limit = vi.fn().mockResolvedValue([{ metadata: { theme: 'dark' } }])
    mockGetDb.mockReturnValue(chain as never)

    await expect(requireAdmin('user-1')).rejects.toThrow('Admin access required')
  })
})

describe('listUsers', () => {
  it('returns users with default pagination', async () => {
    const mockUser = {
      user: {
        id: 'u1',
        email: 'test@example.com',
        name: 'Test User',
        status: 'active',
        emailVerified: true,
        loginCount: 5,
        lastLoginAt: new Date('2026-01-01'),
        createdAt: new Date('2025-12-01'),
      },
      plan: 'pro',
      subscriptionStatus: 'active',
    }

    // We need two separate chains: one for the main query, one for the count query
    const mainChain = createMockChain()
    const countChain = createMockChain()

    let selectCallCount = 0
    const mockDb = {
      select: vi.fn().mockImplementation(() => {
        selectCallCount++
        if (selectCallCount === 1) {
          return mainChain
        }
        return countChain
      }),
    }

    mainChain.from = vi.fn().mockReturnValue(mainChain)
    mainChain.leftJoin = vi.fn().mockReturnValue(mainChain)
    mainChain.orderBy = vi.fn().mockReturnValue(mainChain)
    mainChain.limit = vi.fn().mockReturnValue(mainChain)
    mainChain.offset = vi.fn().mockResolvedValue([mockUser])

    countChain.from = vi.fn().mockReturnValue(countChain)
    countChain.then = vi.fn((resolve) => resolve([{ count: 1 }]))

    mockGetDb.mockReturnValue(mockDb as never)

    const result = await listUsers()

    expect(result.users).toHaveLength(1)
    expect(result.users[0].id).toBe('u1')
    expect(result.users[0].email).toBe('test@example.com')
    expect(result.users[0].plan).toBe('pro')
    expect(result.total).toBe(1)
  })

  it('applies search filter on email and name', async () => {
    const mainChain = createMockChain()
    const countChain = createMockChain()

    let selectCallCount = 0
    const mockDb = {
      select: vi.fn().mockImplementation(() => {
        selectCallCount++
        if (selectCallCount === 1) {
          return mainChain
        }
        return countChain
      }),
    }

    mainChain.from = vi.fn().mockReturnValue(mainChain)
    mainChain.leftJoin = vi.fn().mockReturnValue(mainChain)
    mainChain.where = vi.fn().mockReturnValue(mainChain)
    mainChain.orderBy = vi.fn().mockReturnValue(mainChain)
    mainChain.limit = vi.fn().mockReturnValue(mainChain)
    mainChain.offset = vi.fn().mockResolvedValue([])

    countChain.from = vi.fn().mockReturnValue(countChain)
    countChain.where = vi.fn().mockReturnValue(countChain)
    countChain.then = vi.fn((resolve) => resolve([{ count: 0 }]))

    mockGetDb.mockReturnValue(mockDb as never)

    const result = await listUsers({ search: 'test' })

    expect(result.users).toHaveLength(0)
    expect(result.total).toBe(0)
    // Verify where was called on both query chains (search filter applied)
    expect(mainChain.where).toHaveBeenCalled()
    expect(countChain.where).toHaveBeenCalled()
  })

  it('uses custom limit and offset', async () => {
    const mainChain = createMockChain()
    const countChain = createMockChain()

    let selectCallCount = 0
    const mockDb = {
      select: vi.fn().mockImplementation(() => {
        selectCallCount++
        if (selectCallCount === 1) {
          return mainChain
        }
        return countChain
      }),
    }

    mainChain.from = vi.fn().mockReturnValue(mainChain)
    mainChain.leftJoin = vi.fn().mockReturnValue(mainChain)
    mainChain.orderBy = vi.fn().mockReturnValue(mainChain)
    mainChain.limit = vi.fn().mockReturnValue(mainChain)
    mainChain.offset = vi.fn().mockResolvedValue([])

    countChain.from = vi.fn().mockReturnValue(countChain)
    countChain.then = vi.fn((resolve) => resolve([{ count: 0 }]))

    mockGetDb.mockReturnValue(mockDb as never)

    await listUsers({ limit: 10, offset: 20 })

    expect(mainChain.limit).toHaveBeenCalledWith(10)
    expect(mainChain.offset).toHaveBeenCalledWith(20)
  })
})

describe('updateUserStatus', () => {
  it('updates user status to suspended', async () => {
    const chain = createMockChain()
    chain.where = vi.fn().mockResolvedValue(undefined)
    mockGetDb.mockReturnValue(chain as never)

    await updateUserStatus('user-1', 'suspended')

    expect(chain.update).toHaveBeenCalled()
    expect(chain.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'suspended' })
    )
    expect(chain.where).toHaveBeenCalled()
  })

  it('updates user status to banned', async () => {
    const chain = createMockChain()
    chain.where = vi.fn().mockResolvedValue(undefined)
    mockGetDb.mockReturnValue(chain as never)

    await updateUserStatus('user-1', 'banned')

    expect(chain.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'banned' })
    )
  })

  it('updates user status to active', async () => {
    const chain = createMockChain()
    chain.where = vi.fn().mockResolvedValue(undefined)
    mockGetDb.mockReturnValue(chain as never)

    await updateUserStatus('user-1', 'active')

    expect(chain.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'active' })
    )
  })
})

describe('setUserAdmin', () => {
  it('sets user as admin when isAdmin is true', async () => {
    // First call: select to get current metadata
    const selectChain = createMockChain()
    selectChain.limit = vi.fn().mockResolvedValue([{ metadata: { theme: 'dark' } }])

    // Second call: update
    const updateChain = createMockChain()
    updateChain.where = vi.fn().mockResolvedValue(undefined)

    let callCount = 0
    const mockDb = {
      select: vi.fn().mockImplementation(() => {
        callCount++
        return selectChain
      }),
      update: vi.fn().mockReturnValue(updateChain),
    }

    mockGetDb.mockReturnValue(mockDb as never)

    await setUserAdmin('user-1', true)

    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: { theme: 'dark', role: 'admin' },
      })
    )
  })

  it('removes admin role when isAdmin is false', async () => {
    const selectChain = createMockChain()
    selectChain.limit = vi.fn().mockResolvedValue([{ metadata: { role: 'admin', theme: 'dark' } }])

    const updateChain = createMockChain()
    updateChain.where = vi.fn().mockResolvedValue(undefined)

    const mockDb = {
      select: vi.fn().mockReturnValue(selectChain),
      update: vi.fn().mockReturnValue(updateChain),
    }

    mockGetDb.mockReturnValue(mockDb as never)

    await setUserAdmin('user-1', false)

    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: { role: 'user', theme: 'dark' },
      })
    )
  })

  it('handles user with no existing metadata', async () => {
    const selectChain = createMockChain()
    selectChain.limit = vi.fn().mockResolvedValue([{ metadata: null }])

    const updateChain = createMockChain()
    updateChain.where = vi.fn().mockResolvedValue(undefined)

    const mockDb = {
      select: vi.fn().mockReturnValue(selectChain),
      update: vi.fn().mockReturnValue(updateChain),
    }

    mockGetDb.mockReturnValue(mockDb as never)

    await setUserAdmin('user-1', true)

    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: { role: 'admin' },
      })
    )
  })
})
