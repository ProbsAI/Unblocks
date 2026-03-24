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

function buildListAndCountDb(rows: unknown[], total: number) {
  const offsetMock = vi.fn().mockResolvedValue(rows)
  const limitMock = vi.fn().mockReturnValue({ offset: offsetMock })
  const orderByMock = vi.fn().mockReturnValue({ limit: limitMock })
  const listWhereMock = vi.fn().mockReturnValue({ orderBy: orderByMock })
  const listFromMock = vi.fn().mockReturnValue({ where: listWhereMock })

  const countWhereMock = vi.fn().mockResolvedValue([{ count: total }])
  const countFromMock = vi.fn().mockReturnValue({ where: countWhereMock })

  let callIdx = 0
  const db = {
    select: vi.fn(() => {
      callIdx++
      if (callIdx === 1) return { from: listFromMock }
      return { from: countFromMock }
    }),
  }

  return { db, limitMock, offsetMock }
}

describe('getNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns notifications with total count', async () => {
    const { db } = buildListAndCountDb([fakeRow], 1)
    ;(getDb as ReturnType<typeof vi.fn>).mockReturnValue(db)

    const result = await getNotifications('user-1')

    expect(result.notifications).toHaveLength(1)
    expect(result.notifications[0].id).toBe('notif-1')
    expect(result.total).toBe(1)
  })

  it('uses default limit of 50 and offset of 0', async () => {
    const { db, limitMock, offsetMock } = buildListAndCountDb([], 0)
    ;(getDb as ReturnType<typeof vi.fn>).mockReturnValue(db)

    await getNotifications('user-1')

    expect(limitMock).toHaveBeenCalledWith(50)
    expect(offsetMock).toHaveBeenCalledWith(0)
  })

  it('supports custom limit and offset', async () => {
    const { db, limitMock, offsetMock } = buildListAndCountDb([], 0)
    ;(getDb as ReturnType<typeof vi.fn>).mockReturnValue(db)

    await getNotifications('user-1', { limit: 10, offset: 20 })

    expect(limitMock).toHaveBeenCalledWith(10)
    expect(offsetMock).toHaveBeenCalledWith(20)
  })

  it('filters unread only when requested', async () => {
    const { db } = buildListAndCountDb([], 0)
    ;(getDb as ReturnType<typeof vi.fn>).mockReturnValue(db)

    const { and } = await import('drizzle-orm')

    await getNotifications('user-1', { unreadOnly: true })

    // When unreadOnly is true, `and` should be called to combine userId + read conditions
    expect(and).toHaveBeenCalled()
  })

  it('does not use and() when unreadOnly is false', async () => {
    const { db } = buildListAndCountDb([fakeRow], 1)
    ;(getDb as ReturnType<typeof vi.fn>).mockReturnValue(db)

    const { and } = await import('drizzle-orm')
    vi.mocked(and).mockClear()

    await getNotifications('user-1', { unreadOnly: false })

    // and() should NOT be called when unreadOnly is false (only eq for userId)
    expect(and).not.toHaveBeenCalled()
  })

  it('maps row metadata null to empty object', async () => {
    const rowWithNullMeta = { ...fakeRow, metadata: null }
    const { db } = buildListAndCountDb([rowWithNullMeta], 1)
    ;(getDb as ReturnType<typeof vi.fn>).mockReturnValue(db)

    const result = await getNotifications('user-1')

    expect(result.notifications[0].metadata).toEqual({})
  })

  it('returns correct notification shape', async () => {
    const { db } = buildListAndCountDb([fakeRow], 1)
    ;(getDb as ReturnType<typeof vi.fn>).mockReturnValue(db)

    const result = await getNotifications('user-1')

    expect(result.notifications[0]).toEqual({
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
    })
  })

  it('returns empty array and zero total when no results', async () => {
    const { db } = buildListAndCountDb([], 0)
    ;(getDb as ReturnType<typeof vi.fn>).mockReturnValue(db)

    const result = await getNotifications('user-1')

    expect(result.notifications).toEqual([])
    expect(result.total).toBe(0)
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

  it('scopes delete to both notificationId and userId', async () => {
    const returningMock = vi.fn().mockResolvedValue([{ id: 'notif-1' }])
    const whereMock = vi.fn().mockReturnValue({ returning: returningMock })
    const deleteMock = vi.fn().mockReturnValue({ where: whereMock })
    const db = { delete: deleteMock };
    (getDb as ReturnType<typeof vi.fn>).mockReturnValue(db)

    const { and } = await import('drizzle-orm')

    await deleteNotification('notif-1', 'user-1')

    // and() is used to combine id + userId conditions
    expect(and).toHaveBeenCalled()
  })
})
