import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../db/client', () => ({ getDb: vi.fn() }))
vi.mock('../db/schema/notifications', () => ({
  notifications: {
    id: 'id',
    userId: 'userId',
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

function buildUpdateDb() {
  const returningMock = vi.fn()
  const whereMock = vi.fn().mockReturnValue({ returning: returningMock })
  const setMock = vi.fn().mockReturnValue({ where: whereMock })
  const updateMock = vi.fn().mockReturnValue({ set: setMock })
  const db = { update: updateMock };
  (getDb as ReturnType<typeof vi.fn>).mockReturnValue(db)
  return { returningMock, setMock, updateMock }
}

function buildSelectDb() {
  const whereMock = vi.fn()
  const fromMock = vi.fn().mockReturnValue({ where: whereMock })
  const selectMock = vi.fn().mockReturnValue({ from: fromMock })
  const db = { select: selectMock };
  (getDb as ReturnType<typeof vi.fn>).mockReturnValue(db)
  return { whereMock, selectMock }
}

describe('markAsRead', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns true when notification is marked as read', async () => {
    const { returningMock, setMock } = buildUpdateDb()
    returningMock.mockResolvedValue([{ id: 'notif-1' }])

    const result = await markAsRead('notif-1', 'user-1')

    expect(result).toBe(true)
    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({ read: true })
    )
  })

  it('returns false when notification is not found', async () => {
    const { returningMock } = buildUpdateDb()
    returningMock.mockResolvedValue([])

    const result = await markAsRead('nonexistent', 'user-1')

    expect(result).toBe(false)
  })

  it('sets readAt to a Date instance', async () => {
    const { returningMock, setMock } = buildUpdateDb()
    returningMock.mockResolvedValue([{ id: 'notif-1' }])

    await markAsRead('notif-1', 'user-1')

    const setArg = setMock.mock.calls[0][0]
    expect(setArg.readAt).toBeInstanceOf(Date)
  })

  it('sets readAt close to current time', async () => {
    const { returningMock, setMock } = buildUpdateDb()
    returningMock.mockResolvedValue([{ id: 'notif-1' }])

    const before = new Date()
    await markAsRead('notif-1', 'user-1')
    const after = new Date()

    const setArg = setMock.mock.calls[0][0]
    expect(setArg.readAt.getTime()).toBeGreaterThanOrEqual(before.getTime())
    expect(setArg.readAt.getTime()).toBeLessThanOrEqual(after.getTime())
  })

  it('scopes update to both notificationId and userId', async () => {
    const { returningMock } = buildUpdateDb()
    returningMock.mockResolvedValue([{ id: 'notif-1' }])

    const { and } = await import('drizzle-orm')

    await markAsRead('notif-1', 'user-1')

    expect(and).toHaveBeenCalled()
  })
})

describe('markAllAsRead', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the count of updated notifications', async () => {
    const { returningMock, setMock } = buildUpdateDb()
    returningMock.mockResolvedValue([
      { id: 'notif-1' },
      { id: 'notif-2' },
      { id: 'notif-3' },
    ])

    const count = await markAllAsRead('user-1')

    expect(count).toBe(3)
    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({ read: true })
    )
  })

  it('returns 0 when no unread notifications exist', async () => {
    const { returningMock } = buildUpdateDb()
    returningMock.mockResolvedValue([])

    const count = await markAllAsRead('user-1')

    expect(count).toBe(0)
  })

  it('filters to only unread notifications for the user', async () => {
    const { returningMock } = buildUpdateDb()
    returningMock.mockResolvedValue([])

    const { and, eq } = await import('drizzle-orm')

    await markAllAsRead('user-1')

    // and() should combine userId and read=false
    expect(and).toHaveBeenCalled()
    expect(eq).toHaveBeenCalledWith('userId', 'user-1')
    expect(eq).toHaveBeenCalledWith('read', false)
  })

  it('sets readAt on all updated notifications', async () => {
    const { returningMock, setMock } = buildUpdateDb()
    returningMock.mockResolvedValue([{ id: 'n1' }])

    await markAllAsRead('user-1')

    const setArg = setMock.mock.calls[0][0]
    expect(setArg.read).toBe(true)
    expect(setArg.readAt).toBeInstanceOf(Date)
  })
})

describe('getUnreadCount', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the unread notification count', async () => {
    const { whereMock } = buildSelectDb()
    whereMock.mockResolvedValue([{ count: 5 }])

    const count = await getUnreadCount('user-1')

    expect(count).toBe(5)
  })

  it('returns 0 when no unread notifications', async () => {
    const { whereMock } = buildSelectDb()
    whereMock.mockResolvedValue([{ count: 0 }])

    const count = await getUnreadCount('user-1')

    expect(count).toBe(0)
  })

  it('filters by userId and read=false', async () => {
    const { whereMock } = buildSelectDb()
    whereMock.mockResolvedValue([{ count: 0 }])

    const { and, eq } = await import('drizzle-orm')

    await getUnreadCount('user-1')

    expect(and).toHaveBeenCalled()
    expect(eq).toHaveBeenCalledWith('userId', 'user-1')
    expect(eq).toHaveBeenCalledWith('read', false)
  })
})
