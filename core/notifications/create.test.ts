import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../db/client', () => ({ getDb: vi.fn() }))
vi.mock('../db/schema/notifications', () => ({
  notifications: { userId: 'userId', category: 'category', id: 'id' },
  notificationPreferences: { userId: 'userId', category: 'category' },
}))
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ a, b })),
  and: vi.fn((...args) => args),
  desc: vi.fn(),
  count: vi.fn(),
  sql: vi.fn(),
}))
vi.mock('../security/encryption', () => ({
  encrypt: vi.fn((v: string) => 'enc_' + v),
}))
vi.mock('../runtime/hookRunner', () => ({
  runHook: vi.fn(),
}))

import { getDb } from '../db/client'
import { runHook } from '../runtime/hookRunner'
import { encrypt } from '../security/encryption'
import {
  createNotification,
  createBulkNotifications,
  subscribeToStream,
} from './create'

const mockReturning = vi.fn()
const mockValues = vi.fn(() => ({ returning: mockReturning }))
const mockInsert = vi.fn(() => ({ values: mockValues }))

const mockLimit = vi.fn()
const mockWhere = vi.fn(() => ({ limit: mockLimit }))
const mockFrom = vi.fn(() => ({ where: mockWhere }))
const mockSelect = vi.fn(() => ({ from: mockFrom }))

function setupDb() {
  const db = {
    select: mockSelect,
    insert: mockInsert,
  };
  (getDb as ReturnType<typeof vi.fn>).mockReturnValue(db)
  return db
}

const fakeNotificationRow = {
  id: 'notif-1',
  userId: 'user-1',
  category: 'billing',
  type: 'info',
  title: 'Test Title',
  body: 'Test Body',
  actionUrl: null,
  read: false,
  readAt: null,
  metadata: {},
  createdAt: new Date('2026-01-01'),
  titleEncrypted: 'enc_Test Title',
  bodyEncrypted: 'enc_Test Body',
}

describe('createNotification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupDb()
  })

  it('creates a notification when user has no preferences set', async () => {
    mockLimit.mockResolvedValue([]) // no prefs
    mockReturning.mockResolvedValue([fakeNotificationRow])

    const result = await createNotification({
      userId: 'user-1',
      category: 'billing',
      title: 'Test Title',
      body: 'Test Body',
    })

    expect(result).not.toBeNull()
    expect(result!.id).toBe('notif-1')
    expect(result!.title).toBe('Test Title')
    expect(encrypt).toHaveBeenCalledWith('Test Title')
    expect(encrypt).toHaveBeenCalledWith('Test Body')
    expect(runHook).toHaveBeenCalledWith('onNotificationCreated', {
      notification: expect.objectContaining({ id: 'notif-1' }),
    })
  })

  it('returns null when user has disabled the category', async () => {
    mockLimit.mockResolvedValue([{ inApp: false, category: 'billing' }])

    const result = await createNotification({
      userId: 'user-1',
      category: 'billing',
      title: 'Test Title',
      body: 'Test Body',
    })

    expect(result).toBeNull()
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('creates notification when user has enabled the category', async () => {
    mockLimit.mockResolvedValue([{ inApp: true, category: 'billing' }])
    mockReturning.mockResolvedValue([fakeNotificationRow])

    const result = await createNotification({
      userId: 'user-1',
      category: 'billing',
      title: 'Test Title',
      body: 'Test Body',
    })

    expect(result).not.toBeNull()
    expect(result!.id).toBe('notif-1')
  })

  it('encrypts title and body before inserting', async () => {
    mockLimit.mockResolvedValue([])
    mockReturning.mockResolvedValue([fakeNotificationRow])

    await createNotification({
      userId: 'user-1',
      category: 'billing',
      title: 'Secret Title',
      body: 'Secret Body',
    })

    expect(encrypt).toHaveBeenCalledWith('Secret Title')
    expect(encrypt).toHaveBeenCalledWith('Secret Body')
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        titleEncrypted: 'enc_Secret Title',
        bodyEncrypted: 'enc_Secret Body',
      })
    )
  })

  it('fires onNotificationCreated hook after insert', async () => {
    mockLimit.mockResolvedValue([])
    mockReturning.mockResolvedValue([fakeNotificationRow])

    await createNotification({
      userId: 'user-1',
      category: 'billing',
      title: 'Test Title',
      body: 'Test Body',
    })

    expect(runHook).toHaveBeenCalledWith('onNotificationCreated', {
      notification: expect.objectContaining({
        id: 'notif-1',
        userId: 'user-1',
        category: 'billing',
      }),
    })
  })

  it('does not fire hook when notification is skipped due to preferences', async () => {
    mockLimit.mockResolvedValue([{ inApp: false }])

    await createNotification({
      userId: 'user-1',
      category: 'billing',
      title: 'Test',
      body: 'Body',
    })

    expect(runHook).not.toHaveBeenCalled()
  })

  it('passes optional fields through to insert', async () => {
    mockLimit.mockResolvedValue([])
    mockReturning.mockResolvedValue([{
      ...fakeNotificationRow,
      type: 'warning',
      actionUrl: 'https://example.com',
      metadata: { key: 'val' },
    }])

    await createNotification({
      userId: 'user-1',
      category: 'billing',
      title: 'Test Title',
      body: 'Test Body',
      type: 'warning',
      actionUrl: 'https://example.com',
      metadata: { key: 'val' },
    })

    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'warning',
        actionUrl: 'https://example.com',
        metadata: { key: 'val' },
      })
    )
  })

  it('defaults type to info and optional fields to null/empty', async () => {
    mockLimit.mockResolvedValue([])
    mockReturning.mockResolvedValue([fakeNotificationRow])

    await createNotification({
      userId: 'user-1',
      category: 'billing',
      title: 'Test',
      body: 'Body',
    })

    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'info',
        actionUrl: null,
        metadata: {},
      })
    )
  })

  it('returns the mapped notification object', async () => {
    mockLimit.mockResolvedValue([])
    mockReturning.mockResolvedValue([fakeNotificationRow])

    const result = await createNotification({
      userId: 'user-1',
      category: 'billing',
      title: 'Test Title',
      body: 'Test Body',
    })

    expect(result).toEqual({
      id: 'notif-1',
      userId: 'user-1',
      category: 'billing',
      type: 'info',
      title: 'Test Title',
      body: 'Test Body',
      actionUrl: null,
      read: false,
      readAt: null,
      metadata: {},
      createdAt: new Date('2026-01-01'),
    })
  })
})

describe('createBulkNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupDb()
  })

  it('creates notifications for each userId and returns count', async () => {
    mockLimit.mockResolvedValue([])
    mockReturning.mockResolvedValue([fakeNotificationRow])

    const count = await createBulkNotifications(
      ['user-1', 'user-2', 'user-3'],
      { category: 'billing', title: 'Bulk', body: 'Body' }
    )

    expect(count).toBe(3)
  })

  it('counts only successfully created notifications', async () => {
    // First and third succeed, second is disabled
    mockLimit
      .mockResolvedValueOnce([]) // user-1: no prefs
      .mockResolvedValueOnce([{ inApp: false }]) // user-2: disabled
      .mockResolvedValueOnce([]) // user-3: no prefs
    mockReturning.mockResolvedValue([fakeNotificationRow])

    const count = await createBulkNotifications(
      ['user-1', 'user-2', 'user-3'],
      { category: 'billing', title: 'Bulk', body: 'Body' }
    )

    expect(count).toBe(2)
  })

  it('returns 0 for empty userIds array', async () => {
    const count = await createBulkNotifications(
      [],
      { category: 'billing', title: 'Bulk', body: 'Body' }
    )

    expect(count).toBe(0)
  })

  it('calls createNotification for each userId with merged input', async () => {
    mockLimit.mockResolvedValue([])
    mockReturning.mockResolvedValue([fakeNotificationRow])

    await createBulkNotifications(
      ['user-1', 'user-2'],
      { category: 'system', title: 'Announcement', body: 'New feature' }
    )

    // Two insert calls expected
    expect(mockInsert).toHaveBeenCalledTimes(2)
  })
})

describe('subscribeToStream', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupDb()
  })

  it('calls callback when notification is broadcast via addToStream', async () => {
    const callback = vi.fn()
    const unsubscribe = subscribeToStream('stream-user', callback)

    // Trigger addToStream indirectly through createNotification
    mockLimit.mockResolvedValue([])
    mockReturning.mockResolvedValue([{
      ...fakeNotificationRow,
      userId: 'stream-user',
    }])

    await createNotification({
      userId: 'stream-user',
      category: 'billing',
      title: 'Stream Test',
      body: 'Body',
    })

    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'stream-user' })
    )

    unsubscribe()
  })

  it('returns an unsubscribe function that removes the callback', async () => {
    const callback = vi.fn()
    const unsubscribe = subscribeToStream('stream-user-2', callback)
    unsubscribe()

    // After unsubscribe, creating a notification should not trigger the callback
    mockLimit.mockResolvedValue([])
    mockReturning.mockResolvedValue([{
      ...fakeNotificationRow,
      userId: 'stream-user-2',
    }])

    await createNotification({
      userId: 'stream-user-2',
      category: 'billing',
      title: 'Test',
      body: 'Body',
    })

    expect(callback).not.toHaveBeenCalled()
  })

  it('supports multiple subscribers for the same user', async () => {
    const cb1 = vi.fn()
    const cb2 = vi.fn()
    const unsub1 = subscribeToStream('multi-user', cb1)
    const unsub2 = subscribeToStream('multi-user', cb2)

    mockLimit.mockResolvedValue([])
    mockReturning.mockResolvedValue([{
      ...fakeNotificationRow,
      userId: 'multi-user',
    }])

    await createNotification({
      userId: 'multi-user',
      category: 'system',
      title: 'Multi',
      body: 'Body',
    })

    expect(cb1).toHaveBeenCalled()
    expect(cb2).toHaveBeenCalled()

    unsub1()
    unsub2()
  })

  it('does not error if callback throws during stream broadcast', async () => {
    const errorCallback = vi.fn(() => { throw new Error('stream error') })
    const goodCallback = vi.fn()

    subscribeToStream('error-user', errorCallback)
    subscribeToStream('error-user', goodCallback)

    mockLimit.mockResolvedValue([])
    mockReturning.mockResolvedValue([{
      ...fakeNotificationRow,
      userId: 'error-user',
    }])

    // Should not throw even though one callback errors
    await expect(
      createNotification({
        userId: 'error-user',
        category: 'system',
        title: 'Error Test',
        body: 'Body',
      })
    ).resolves.not.toThrow()
  })
})
