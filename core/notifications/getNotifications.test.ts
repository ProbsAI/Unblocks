import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../db/client', () => ({ getDb: vi.fn() }))
vi.mock('../db/schema/notifications', () => ({
  notifications: {
    userId: 'userId',
    id: 'id',
    read: 'read',
    createdAt: 'createdAt',
  },
}))
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ a, b })),
  and: vi.fn((...args) => args),
  desc: vi.fn(),
  count: vi.fn(),
  sql: vi.fn(),
}))

import { getDb } from '../db/client'
import { getNotifications, deleteNotification } from './getNotifications'

const fakeRow = {
  id: 'notif-1',
  userId: 'user-1',
  category: 'billing',
  type: 'info',
  title: 'Title',
  body: 'Body',
  actionUrl: null,
  read: false,
  readAt: null,
  metadata: {},
  createdAt: new Date('2026-01-01'),
}

function createChainableMock(resolvedValue: unknown) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain.offset = vi.fn().mockResolvedValue(resolvedValue)
  chain.limit = vi.fn(() => ({ offset: chain.offset }))
  chain.orderBy = vi.fn(() => ({ limit: chain.limit }))
  chain.where = vi.fn(() => ({ orderBy: chain.orderBy, limit: chain.limit }))
  chain.from = vi.fn(() => ({ where: chain.where }))
  chain.select = vi.fn(() => ({ from: chain.from }))
  return chain
}

describe('getNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns notifications with total count', async () => {
    const listChain = createChainableMock([fakeRow])
    const countChain = createChainableMock([{ count: 1 }])

    let selectCallCount = 0
    const db = {
      select: vi.fn((...args: unknown[]) => {
        selectCallCount++
        if (selectCallCount === 1) return listChain.select(...args)
        return countChain.select(...args)
      }),
    };
    (getDb as ReturnType<typeof vi.fn>).mockReturnValue(db)

    // Mock Promise.all by making each chain resolve properly
    // The function uses Promise.all so we need both chains to work
    listChain.from.mockReturnValue({ where: vi.fn().mockReturnValue({ orderBy: vi.fn().mockReturnValue({ limit: vi.fn().mockReturnValue({ offset: vi.fn().mockResolvedValue([fakeRow]) }) }) }) })
    countChain.from.mockReturnValue({ where: vi.fn().mockResolvedValue([{ count: 1 }]) })

    const result = await getNotifications('user-1')

    expect(result.notifications).toHaveLength(1)
    expect(result.notifications[0].id).toBe('notif-1')
    expect(result.total).toBe(1)
  })

  it('uses default limit of 50 and offset of 0', async () => {
    const offsetMock = vi.fn().mockResolvedValue([])
    const limitMock = vi.fn().mockReturnValue({ offset: offsetMock })
    const orderByMock = vi.fn().mockReturnValue({ limit: limitMock })
    const whereMock1 = vi.fn().mockReturnValue({ orderBy: orderByMock })
    const fromMock1 = vi.fn().mockReturnValue({ where: whereMock1 })

    const whereMock2 = vi.fn().mockResolvedValue([{ count: 0 }])
    const fromMock2 = vi.fn().mockReturnValue({ where: whereMock2 })

    let callIdx = 0
    const db = {
      select: vi.fn(() => {
        callIdx++
        if (callIdx === 1) return { from: fromMock1 }
        return { from: fromMock2 }
      }),
    };
    (getDb as ReturnType<typeof vi.fn>).mockReturnValue(db)

    await getNotifications('user-1')

    expect(limitMock).toHaveBeenCalledWith(50)
    expect(offsetMock).toHaveBeenCalledWith(0)
  })

  it('supports custom limit and offset', async () => {
    const offsetMock = vi.fn().mockResolvedValue([])
    const limitMock = vi.fn().mockReturnValue({ offset: offsetMock })
    const orderByMock = vi.fn().mockReturnValue({ limit: limitMock })
    const whereMock1 = vi.fn().mockReturnValue({ orderBy: orderByMock })
    const fromMock1 = vi.fn().mockReturnValue({ where: whereMock1 })

    const whereMock2 = vi.fn().mockResolvedValue([{ count: 0 }])
    const fromMock2 = vi.fn().mockReturnValue({ where: whereMock2 })

    let callIdx = 0
    const db = {
      select: vi.fn(() => {
        callIdx++
        if (callIdx === 1) return { from: fromMock1 }
        return { from: fromMock2 }
      }),
    };
    (getDb as ReturnType<typeof vi.fn>).mockReturnValue(db)

    await getNotifications('user-1', { limit: 10, offset: 20 })

    expect(limitMock).toHaveBeenCalledWith(10)
    expect(offsetMock).toHaveBeenCalledWith(20)
  })

  it('filters unread only when requested', async () => {
    const offsetMock = vi.fn().mockResolvedValue([])
    const limitMock = vi.fn().mockReturnValue({ offset: offsetMock })
    const orderByMock = vi.fn().mockReturnValue({ limit: limitMock })
    const whereMock1 = vi.fn().mockReturnValue({ orderBy: orderByMock })
    const fromMock1 = vi.fn().mockReturnValue({ where: whereMock1 })

    const whereMock2 = vi.fn().mockResolvedValue([{ count: 0 }])
    const fromMock2 = vi.fn().mockReturnValue({ where: whereMock2 })

    let callIdx = 0
    const db = {
      select: vi.fn(() => {
        callIdx++
        if (callIdx === 1) return { from: fromMock1 }
        return { from: fromMock2 }
      }),
    };
    (getDb as ReturnType<typeof vi.fn>).mockReturnValue(db)

    const { and } = await import('drizzle-orm')

    await getNotifications('user-1', { unreadOnly: true })

    // When unreadOnly is true, `and` should be called to combine conditions
    expect(and).toHaveBeenCalled()
  })
})

describe('deleteNotification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns true when notification is deleted', async () => {
    const returningMock = vi.fn().mockResolvedValue([{ id: 'notif-1' }])
    const whereMock = vi.fn().mockReturnValue({ returning: returningMock })
    const deleteMock = vi.fn().mockReturnValue({ where: whereMock })
    const db = { delete: deleteMock };
    (getDb as ReturnType<typeof vi.fn>).mockReturnValue(db)

    const result = await deleteNotification('notif-1', 'user-1')
    expect(result).toBe(true)
  })

  it('returns false when notification is not found', async () => {
    const returningMock = vi.fn().mockResolvedValue([])
    const whereMock = vi.fn().mockReturnValue({ returning: returningMock })
    const deleteMock = vi.fn().mockReturnValue({ where: whereMock })
    const db = { delete: deleteMock };
    (getDb as ReturnType<typeof vi.fn>).mockReturnValue(db)

    const result = await deleteNotification('nonexistent', 'user-1')
    expect(result).toBe(false)
  })
})
