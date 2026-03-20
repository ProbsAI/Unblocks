import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../db/client', () => ({ getDb: vi.fn() }))
vi.mock('../db/schema/notifications', () => ({
  notificationPreferences: {
    userId: 'userId',
    category: 'category',
    id: 'id',
  },
}))
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ a, b })),
  and: vi.fn((...args) => args),
  desc: vi.fn(),
  count: vi.fn(),
  sql: vi.fn(),
}))
vi.mock('../runtime/configLoader', () => ({
  loadConfig: vi.fn().mockReturnValue({
    categories: [
      { id: 'billing', name: 'Billing', description: 'test', defaultEnabled: true },
    ],
    channels: { inApp: true, email: false },
  }),
}))

import { getDb } from '../db/client'
import { getPreferences, updatePreference } from './preferences'

describe('getPreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns config defaults when no DB preferences exist', async () => {
    const whereMock = vi.fn().mockResolvedValue([])
    const fromMock = vi.fn().mockReturnValue({ where: whereMock })
    const selectMock = vi.fn().mockReturnValue({ from: fromMock })
    const db = { select: selectMock };
    (getDb as ReturnType<typeof vi.fn>).mockReturnValue(db)

    const prefs = await getPreferences('user-1')

    expect(prefs).toHaveLength(1)
    expect(prefs[0].category).toBe('billing')
    expect(prefs[0].inApp).toBe(true) // defaultEnabled = true
    expect(prefs[0].email).toBe(false) // channels.email = false && defaultEnabled
    expect(prefs[0].userId).toBe('user-1')
    expect(prefs[0].id).toBe('') // no existing record
  })

  it('merges DB preferences with config categories', async () => {
    const whereMock = vi.fn().mockResolvedValue([
      { id: 'pref-1', userId: 'user-1', category: 'billing', inApp: false, email: true },
    ])
    const fromMock = vi.fn().mockReturnValue({ where: whereMock })
    const selectMock = vi.fn().mockReturnValue({ from: fromMock })
    const db = { select: selectMock };
    (getDb as ReturnType<typeof vi.fn>).mockReturnValue(db)

    const prefs = await getPreferences('user-1')

    expect(prefs).toHaveLength(1)
    expect(prefs[0].inApp).toBe(false) // from DB
    expect(prefs[0].email).toBe(true) // from DB
    expect(prefs[0].id).toBe('pref-1')
  })
})

describe('updatePreference', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('updates existing preference', async () => {
    const limitMock = vi.fn().mockResolvedValue([
      { id: 'pref-1', userId: 'user-1', category: 'billing', inApp: true, email: false },
    ])
    const selectWhereMock = vi.fn().mockReturnValue({ limit: limitMock })
    const selectFromMock = vi.fn().mockReturnValue({ where: selectWhereMock })
    const selectMock = vi.fn().mockReturnValue({ from: selectFromMock })

    const returningMock = vi.fn().mockResolvedValue([
      { id: 'pref-1', userId: 'user-1', category: 'billing', inApp: false, email: true },
    ])
    const updateWhereMock = vi.fn().mockReturnValue({ returning: returningMock })
    const setMock = vi.fn().mockReturnValue({ where: updateWhereMock })
    const updateMock = vi.fn().mockReturnValue({ set: setMock })

    const db = { select: selectMock, update: updateMock };
    (getDb as ReturnType<typeof vi.fn>).mockReturnValue(db)

    const result = await updatePreference('user-1', 'billing', {
      inApp: false,
      email: true,
    })

    expect(result.inApp).toBe(false)
    expect(result.email).toBe(true)
    expect(updateMock).toHaveBeenCalled()
  })

  it('inserts new preference when none exists', async () => {
    const limitMock = vi.fn().mockResolvedValue([])
    const selectWhereMock = vi.fn().mockReturnValue({ limit: limitMock })
    const selectFromMock = vi.fn().mockReturnValue({ where: selectWhereMock })
    const selectMock = vi.fn().mockReturnValue({ from: selectFromMock })

    const returningMock = vi.fn().mockResolvedValue([
      { id: 'pref-new', userId: 'user-1', category: 'billing', inApp: false, email: false },
    ])
    const valuesMock = vi.fn().mockReturnValue({ returning: returningMock })
    const insertMock = vi.fn().mockReturnValue({ values: valuesMock })

    const db = { select: selectMock, insert: insertMock };
    (getDb as ReturnType<typeof vi.fn>).mockReturnValue(db)

    const result = await updatePreference('user-1', 'billing', {
      inApp: false,
    })

    expect(result.id).toBe('pref-new')
    expect(result.inApp).toBe(false)
    expect(insertMock).toHaveBeenCalled()
  })

  it('uses config defaults for fields not specified in updates', async () => {
    const limitMock = vi.fn().mockResolvedValue([])
    const selectWhereMock = vi.fn().mockReturnValue({ limit: limitMock })
    const selectFromMock = vi.fn().mockReturnValue({ where: selectWhereMock })
    const selectMock = vi.fn().mockReturnValue({ from: selectFromMock })

    const returningMock = vi.fn().mockResolvedValue([
      { id: 'pref-new', userId: 'user-1', category: 'billing', inApp: true, email: false },
    ])
    const valuesMock = vi.fn().mockReturnValue({ returning: returningMock })
    const insertMock = vi.fn().mockReturnValue({ values: valuesMock })

    const db = { select: selectMock, insert: insertMock };
    (getDb as ReturnType<typeof vi.fn>).mockReturnValue(db)

    await updatePreference('user-1', 'billing', { email: true })

    // inApp should default to defaultEnabled (true) since not specified
    expect(valuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        inApp: true, // defaultEnabled = true
        email: true, // explicitly set
      })
    )
  })
})
