import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../db/client', () => ({ getDb: vi.fn() }))
vi.mock('../db/schema/notifications', () => ({
  notifications: {
    userId: 'userId',
    id: 'id',
    read: 'read',
  },
}))
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ a, b })),
  and: vi.fn((...args) => args),
  desc: vi.fn(),
  count: vi.fn(),
  sql: vi.fn(() => 'count_sql'),
}))

import { getDb } from '../db/client'
import { markAsRead, markAllAsRead, getUnreadCount } from './markRead'

describe('markAsRead', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns true when notification is marked as read', async () => {
    const returningMock = vi.fn().mockResolvedValue([{ id: 'notif-1' }])
    const whereMock = vi.fn().mockReturnValue({ returning: returningMock })
    const setMock = vi.fn().mockReturnValue({ where: whereMock })
    const updateMock = vi.fn().mockReturnValue({ set: setMock })
    const db = { update: updateMock };
    (getDb as ReturnType<typeof vi.fn>).mockReturnValue(db)

    const result = await markAsRead('notif-1', 'user-1')

    expect(result).toBe(true)
    expect(updateMock).toHaveBeenCalled()
    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({ read: true })
    )
  })

  it('returns false when notification is not found', async () => {
    const returningMock = vi.fn().mockResolvedValue([])
    const whereMock = vi.fn().mockReturnValue({ returning: returningMock })
    const setMock = vi.fn().mockReturnValue({ where: whereMock })
    const updateMock = vi.fn().mockReturnValue({ set: setMock })
    const db = { update: updateMock };
    (getDb as ReturnType<typeof vi.fn>).mockReturnValue(db)

    const result = await markAsRead('nonexistent', 'user-1')

    expect(result).toBe(false)
  })

  it('sets readAt to a Date', async () => {
    const returningMock = vi.fn().mockResolvedValue([{ id: 'notif-1' }])
    const whereMock = vi.fn().mockReturnValue({ returning: returningMock })
    const setMock = vi.fn().mockReturnValue({ where: whereMock })
    const updateMock = vi.fn().mockReturnValue({ set: setMock })
    const db = { update: updateMock };
    (getDb as ReturnType<typeof vi.fn>).mockReturnValue(db)

    await markAsRead('notif-1', 'user-1')

    const setArg = setMock.mock.calls[0][0]
    expect(setArg.readAt).toBeInstanceOf(Date)
  })
})

describe('markAllAsRead', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the count of updated notifications', async () => {
    const returningMock = vi.fn().mockResolvedValue([
      { id: 'notif-1' },
      { id: 'notif-2' },
      { id: 'notif-3' },
    ])
    const whereMock = vi.fn().mockReturnValue({ returning: returningMock })
    const setMock = vi.fn().mockReturnValue({ where: whereMock })
    const updateMock = vi.fn().mockReturnValue({ set: setMock })
    const db = { update: updateMock };
    (getDb as ReturnType<typeof vi.fn>).mockReturnValue(db)

    const count = await markAllAsRead('user-1')

    expect(count).toBe(3)
    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({ read: true })
    )
  })

  it('returns 0 when no unread notifications exist', async () => {
    const returningMock = vi.fn().mockResolvedValue([])
    const whereMock = vi.fn().mockReturnValue({ returning: returningMock })
    const setMock = vi.fn().mockReturnValue({ where: whereMock })
    const updateMock = vi.fn().mockReturnValue({ set: setMock })
    const db = { update: updateMock };
    (getDb as ReturnType<typeof vi.fn>).mockReturnValue(db)

    const count = await markAllAsRead('user-1')

    expect(count).toBe(0)
  })
})

describe('getUnreadCount', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the unread notification count', async () => {
    const whereMock = vi.fn().mockResolvedValue([{ count: 5 }])
    const fromMock = vi.fn().mockReturnValue({ where: whereMock })
    const selectMock = vi.fn().mockReturnValue({ from: fromMock })
    const db = { select: selectMock };
    (getDb as ReturnType<typeof vi.fn>).mockReturnValue(db)

    const count = await getUnreadCount('user-1')

    expect(count).toBe(5)
  })

  it('returns 0 when no unread notifications', async () => {
    const whereMock = vi.fn().mockResolvedValue([{ count: 0 }])
    const fromMock = vi.fn().mockReturnValue({ where: whereMock })
    const selectMock = vi.fn().mockReturnValue({ from: fromMock })
    const db = { select: selectMock };
    (getDb as ReturnType<typeof vi.fn>).mockReturnValue(db)

    const count = await getUnreadCount('user-1')

    expect(count).toBe(0)
  })
})
