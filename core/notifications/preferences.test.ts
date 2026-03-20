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
      { id: 'team', name: 'Team', description: 'test', defaultEnabled: true },
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

    expect(prefs).toHaveLength(2)
    expect(prefs[0]).toEqual({
      id: '',
      userId: 'user-1',
      category: 'billing',
      inApp: true, // defaultEnabled = true
      email: false, // channels.email = false
    })
    expect(prefs[1]).toEqual({
      id: '',
      userId: 'user-1',
      category: 'team',
      inApp: true,
      email: false,
    })
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

    expect(prefs).toHaveLength(2)
    // billing uses DB values
    expect(prefs[0]).toEqual({
      id: 'pref-1',
      userId: 'user-1',
      category: 'billing',
      inApp: false,
      email: true,
    })
    // team uses config defaults
    expect(prefs[1]).toEqual({
      id: '',
      userId: 'user-1',
      category: 'team',
      inApp: true,
      email: false,
    })
  })

  it('returns one preference per config category', async () => {
    const whereMock = vi.fn().mockResolvedValue([])
    const fromMock = vi.fn().mockReturnValue({ where: whereMock })
    const selectMock = vi.fn().mockReturnValue({ from: fromMock })
    const db = { select: selectMock };
    (getDb as ReturnType<typeof vi.fn>).mockReturnValue(db)

    const prefs = await getPreferences('user-1')

    const categories = prefs.map(p => p.category)
    expect(categories).toEqual(['billing', 'team'])
  })

  it('sets empty id for categories without saved preferences', async () => {
    const whereMock = vi.fn().mockResolvedValue([])
    const fromMock = vi.fn().mockReturnValue({ where: whereMock })
    const selectMock = vi.fn().mockReturnValue({ from: fromMock })
    const db = { select: selectMock };
    (getDb as ReturnType<typeof vi.fn>).mockReturnValue(db)

    const prefs = await getPreferences('user-1')

    expect(prefs[0].id).toBe('')
    expect(prefs[1].id).toBe('')
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

    expect(result).toEqual({
      id: 'pref-1',
      userId: 'user-1',
      category: 'billing',
      inApp: false,
      email: true,
    })
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
      { id: 'pref-new', userId: 'user-1', category: 'billing', inApp: true, email: true },
    ])
    const valuesMock = vi.fn().mockReturnValue({ returning: returningMock })
    const insertMock = vi.fn().mockReturnValue({ values: valuesMock })

    const db = { select: selectMock, insert: insertMock };
    (getDb as ReturnType<typeof vi.fn>).mockReturnValue(db)

    await updatePreference('user-1', 'billing', { email: true })

    // inApp should default to config defaultEnabled (true) since not specified
    expect(valuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        category: 'billing',
        inApp: true,
        email: true,
      })
    )
  })

  it('only updates provided fields when preference exists', async () => {
    const limitMock = vi.fn().mockResolvedValue([
      { id: 'pref-1', userId: 'user-1', category: 'billing', inApp: true, email: false },
    ])
    const selectWhereMock = vi.fn().mockReturnValue({ limit: limitMock })
    const selectFromMock = vi.fn().mockReturnValue({ where: selectWhereMock })
    const selectMock = vi.fn().mockReturnValue({ from: selectFromMock })

    const returningMock = vi.fn().mockResolvedValue([
      { id: 'pref-1', userId: 'user-1', category: 'billing', inApp: false, email: false },
    ])
    const updateWhereMock = vi.fn().mockReturnValue({ returning: returningMock })
    const setMock = vi.fn().mockReturnValue({ where: updateWhereMock })
    const updateMock = vi.fn().mockReturnValue({ set: setMock })

    const db = { select: selectMock, update: updateMock };
    (getDb as ReturnType<typeof vi.fn>).mockReturnValue(db)

    await updatePreference('user-1', 'billing', { inApp: false })

    // Only inApp should be in the set call, not email
    expect(setMock).toHaveBeenCalledWith({ inApp: false })
  })
})
