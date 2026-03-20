import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../db/client', () => ({
  getDb: vi.fn(),
}))

vi.mock('../db/schema/users', () => ({
  users: {
    id: 'id',
    email: 'email',
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
}))

import { getDb } from '../db/client'
import { listSubscriptions } from './subscriptions'

const mockGetDb = vi.mocked(getDb)

function createMockChain(): Record<string, ReturnType<typeof vi.fn>> {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain.select = vi.fn().mockReturnValue(chain)
  chain.from = vi.fn().mockReturnValue(chain)
  chain.where = vi.fn().mockReturnValue(chain)
  chain.limit = vi.fn().mockReturnValue(chain)
  chain.offset = vi.fn().mockReturnValue(chain)
  chain.orderBy = vi.fn().mockReturnValue(chain)
  chain.innerJoin = vi.fn().mockReturnValue(chain)
  chain.then = vi.fn((resolve) => resolve([]))
  return chain
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('listSubscriptions', () => {
  it('returns subscriptions with default pagination', async () => {
    const mockRow = {
      subscription: {
        id: 'sub-1',
        userId: 'user-1',
        plan: 'pro',
        status: 'active',
        interval: 'monthly',
        currentPeriodEnd: new Date('2026-04-01'),
        cancelAtPeriodEnd: false,
        createdAt: new Date('2026-01-01'),
      },
      userEmail: 'test@example.com',
    }

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
    mainChain.innerJoin = vi.fn().mockReturnValue(mainChain)
    mainChain.orderBy = vi.fn().mockReturnValue(mainChain)
    mainChain.limit = vi.fn().mockReturnValue(mainChain)
    mainChain.offset = vi.fn().mockResolvedValue([mockRow])

    countChain.from = vi.fn().mockReturnValue(countChain)
    countChain.then = vi.fn((resolve) => resolve([{ count: 1 }]))

    mockGetDb.mockReturnValue(mockDb as never)

    const result = await listSubscriptions()

    expect(result.subscriptions).toHaveLength(1)
    expect(result.subscriptions[0].id).toBe('sub-1')
    expect(result.subscriptions[0].userEmail).toBe('test@example.com')
    expect(result.subscriptions[0].plan).toBe('pro')
    expect(result.subscriptions[0].status).toBe('active')
    expect(result.total).toBe(1)
  })

  it('applies status filter when provided', async () => {
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
    mainChain.innerJoin = vi.fn().mockReturnValue(mainChain)
    mainChain.where = vi.fn().mockReturnValue(mainChain)
    mainChain.orderBy = vi.fn().mockReturnValue(mainChain)
    mainChain.limit = vi.fn().mockReturnValue(mainChain)
    mainChain.offset = vi.fn().mockResolvedValue([])

    countChain.from = vi.fn().mockReturnValue(countChain)
    countChain.where = vi.fn().mockReturnValue(countChain)
    countChain.then = vi.fn((resolve) => resolve([{ count: 0 }]))

    mockGetDb.mockReturnValue(mockDb as never)

    const result = await listSubscriptions({ status: 'active' })

    expect(result.subscriptions).toHaveLength(0)
    expect(result.total).toBe(0)
    // Both the main query and count query should have where called
    expect(mainChain.where).toHaveBeenCalled()
    expect(countChain.where).toHaveBeenCalled()
  })

  it('does not apply where clause when no status filter', async () => {
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
    mainChain.innerJoin = vi.fn().mockReturnValue(mainChain)
    mainChain.orderBy = vi.fn().mockReturnValue(mainChain)
    mainChain.limit = vi.fn().mockReturnValue(mainChain)
    mainChain.offset = vi.fn().mockResolvedValue([])

    countChain.from = vi.fn().mockReturnValue(countChain)
    countChain.then = vi.fn((resolve) => resolve([{ count: 0 }]))

    mockGetDb.mockReturnValue(mockDb as never)

    await listSubscriptions()

    // where should NOT be called when no status filter
    expect(mainChain.where).not.toHaveBeenCalled()
    expect(countChain.where).not.toHaveBeenCalled()
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
    mainChain.innerJoin = vi.fn().mockReturnValue(mainChain)
    mainChain.orderBy = vi.fn().mockReturnValue(mainChain)
    mainChain.limit = vi.fn().mockReturnValue(mainChain)
    mainChain.offset = vi.fn().mockResolvedValue([])

    countChain.from = vi.fn().mockReturnValue(countChain)
    countChain.then = vi.fn((resolve) => resolve([{ count: 0 }]))

    mockGetDb.mockReturnValue(mockDb as never)

    await listSubscriptions({ limit: 25, offset: 50 })

    expect(mainChain.limit).toHaveBeenCalledWith(25)
    expect(mainChain.offset).toHaveBeenCalledWith(50)
  })

  it('maps subscription rows to AdminSubscription format', async () => {
    const now = new Date()
    const periodEnd = new Date('2026-05-01')
    const mockRow = {
      subscription: {
        id: 'sub-2',
        userId: 'user-2',
        plan: 'enterprise',
        status: 'trialing',
        interval: 'yearly',
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: true,
        createdAt: now,
      },
      userEmail: 'enterprise@example.com',
    }

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
    mainChain.innerJoin = vi.fn().mockReturnValue(mainChain)
    mainChain.orderBy = vi.fn().mockReturnValue(mainChain)
    mainChain.limit = vi.fn().mockReturnValue(mainChain)
    mainChain.offset = vi.fn().mockResolvedValue([mockRow])

    countChain.from = vi.fn().mockReturnValue(countChain)
    countChain.then = vi.fn((resolve) => resolve([{ count: 1 }]))

    mockGetDb.mockReturnValue(mockDb as never)

    const result = await listSubscriptions()

    const sub = result.subscriptions[0]
    expect(sub.id).toBe('sub-2')
    expect(sub.userId).toBe('user-2')
    expect(sub.userEmail).toBe('enterprise@example.com')
    expect(sub.plan).toBe('enterprise')
    expect(sub.status).toBe('trialing')
    expect(sub.interval).toBe('yearly')
    expect(sub.currentPeriodEnd).toBe(periodEnd)
    expect(sub.cancelAtPeriodEnd).toBe(true)
    expect(sub.createdAt).toBe(now)
  })
})
