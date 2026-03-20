import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSelect = vi.fn()
const mockFrom = vi.fn()
const mockWhere = vi.fn()
const mockLimit = vi.fn()
const mockInsert = vi.fn()
const mockValues = vi.fn()
const mockReturning = vi.fn()
const mockUpdate = vi.fn()
const mockSet = vi.fn()
const mockUpdateWhere = vi.fn()

vi.mock('../db/client', () => ({
  getDb: vi.fn(() => ({
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
  })),
}))

vi.mock('../db/schema/users', () => ({
  users: {
    id: 'id',
    email: 'email',
  },
}))

vi.mock('../db/schema/accounts', () => ({
  accounts: {
    id: 'id',
    provider: 'provider',
    providerAccountId: 'providerAccountId',
    userId: 'userId',
  },
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ a, b })),
  and: vi.fn((...args: unknown[]) => args),
}))

vi.mock('../runtime/hookRunner', () => ({
  runHook: vi.fn().mockResolvedValue(undefined),
}))

import {
  getGoogleAuthUrl,
  exchangeGoogleCode,
  getGoogleUserInfo,
  handleOAuthCallback,
} from './oauth'
import { runHook } from '../runtime/hookRunner'

const mockRunHook = vi.mocked(runHook)

const mockDbUser = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test',
  avatarUrl: 'https://example.com/photo.jpg',
  emailVerified: true,
  status: 'active',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
}

let selectCallCount: number

function setupMultiSelectChains(results: unknown[][]) {
  selectCallCount = 0
  mockLimit.mockImplementation(() => {
    const result = results[selectCallCount] ?? []
    selectCallCount++
    return Promise.resolve(result)
  })
  mockWhere.mockReturnValue({ limit: mockLimit })
  mockFrom.mockReturnValue({ where: mockWhere })
  mockSelect.mockReturnValue({ from: mockFrom })
}

function setupInsertChain(returnValue?: unknown[]) {
  if (returnValue) {
    mockReturning.mockResolvedValue(returnValue)
    mockValues.mockReturnValue({ returning: mockReturning })
  } else {
    mockValues.mockResolvedValue(undefined)
  }
  mockInsert.mockReturnValue({ values: mockValues })
}

function setupUpdateChain() {
  mockUpdateWhere.mockResolvedValue(undefined)
  mockSet.mockReturnValue({ where: mockUpdateWhere })
  mockUpdate.mockReturnValue({ set: mockSet })
}

beforeEach(() => {
  vi.clearAllMocks()
  selectCallCount = 0
  setupUpdateChain()
})

describe('getGoogleAuthUrl', () => {
  it('builds correct Google OAuth URL', () => {
    const url = getGoogleAuthUrl(
      'client-id-123',
      'http://localhost:3000/api/auth/google/callback',
      'state-token'
    )

    expect(url).toContain('https://accounts.google.com/o/oauth2/v2/auth')
    expect(url).toContain('client_id=client-id-123')
    expect(url).toContain('response_type=code')
    expect(url).toContain('scope=openid+email+profile')
    expect(url).toContain('state=state-token')
    expect(url).toContain('access_type=offline')
    expect(url).toContain('prompt=consent')
  })

  it('includes redirect_uri in URL', () => {
    const url = getGoogleAuthUrl(
      'client-id',
      'https://example.com/callback',
      'state'
    )

    expect(url).toContain(encodeURIComponent('https://example.com/callback'))
  })
})

describe('exchangeGoogleCode', () => {
  it('exchanges code for tokens', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        access_token: 'access-123',
        refresh_token: 'refresh-456',
      }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const result = await exchangeGoogleCode(
      'auth-code',
      'client-id',
      'client-secret',
      'http://localhost:3000/callback'
    )

    expect(result.accessToken).toBe('access-123')
    expect(result.refreshToken).toBe('refresh-456')
    expect(mockFetch).toHaveBeenCalledWith(
      'https://oauth2.googleapis.com/token',
      expect.objectContaining({ method: 'POST' })
    )

    vi.unstubAllGlobals()
  })

  it('throws error when exchange fails', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false })
    vi.stubGlobal('fetch', mockFetch)

    await expect(
      exchangeGoogleCode('bad-code', 'client-id', 'secret', 'http://localhost/cb')
    ).rejects.toThrow('Failed to exchange OAuth code')

    vi.unstubAllGlobals()
  })

  it('returns null refresh token when not provided', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        access_token: 'access-123',
      }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const result = await exchangeGoogleCode(
      'auth-code',
      'client-id',
      'secret',
      'http://localhost/cb'
    )

    expect(result.refreshToken).toBeNull()

    vi.unstubAllGlobals()
  })
})

describe('getGoogleUserInfo', () => {
  it('fetches user info from Google', async () => {
    const mockUserInfo = {
      sub: 'google-123',
      email: 'user@gmail.com',
      name: 'Test User',
      picture: 'https://photo.url/pic.jpg',
      email_verified: true,
    }
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(mockUserInfo),
    })
    vi.stubGlobal('fetch', mockFetch)

    const result = await getGoogleUserInfo('access-token-123')

    expect(result.email).toBe('user@gmail.com')
    expect(result.name).toBe('Test User')
    expect(mockFetch).toHaveBeenCalledWith(
      'https://www.googleapis.com/oauth2/v3/userinfo',
      { headers: { Authorization: 'Bearer access-token-123' } }
    )

    vi.unstubAllGlobals()
  })

  it('throws error when fetch fails', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false })
    vi.stubGlobal('fetch', mockFetch)

    await expect(getGoogleUserInfo('bad-token')).rejects.toThrow(
      'Failed to fetch Google user info'
    )

    vi.unstubAllGlobals()
  })
})

describe('handleOAuthCallback', () => {
  it('returns existing user when OAuth account already linked', async () => {
    // First select: accounts query finds existing account
    // Second select: users query finds user
    setupMultiSelectChains([
      [{ id: 'account-1', userId: 'user-1' }],
      [mockDbUser],
    ])
    setupUpdateChain()

    const result = await handleOAuthCallback(
      'google',
      'google-123',
      'access-token',
      'refresh-token',
      { email: 'test@example.com', name: 'Test', avatarUrl: 'https://photo.url' }
    )

    expect(result.id).toBe('user-1')
    // Tokens should be updated
    expect(mockUpdate).toHaveBeenCalled()
  })

  it('links OAuth to existing user with same email', async () => {
    // First select: no existing account
    // Second select: existing user by email
    // Third select: final user fetch
    setupMultiSelectChains([
      [],
      [{ ...mockDbUser, name: 'Existing Name', avatarUrl: 'existing-url' }],
      [mockDbUser],
    ])
    setupInsertChain()

    const result = await handleOAuthCallback(
      'google',
      'google-456',
      'access-token',
      null,
      { email: 'test@example.com', name: 'New Name', avatarUrl: 'new-url' }
    )

    expect(result.id).toBe('user-1')
    // Should insert account link
    expect(mockInsert).toHaveBeenCalled()
  })

  it('creates new user when no existing account or user', async () => {
    // First select: no existing account
    // Second select: no existing user
    // Third select: final user fetch
    setupMultiSelectChains([[], [], [mockDbUser]])
    setupInsertChain([mockDbUser])

    const result = await handleOAuthCallback(
      'google',
      'google-789',
      'access-token',
      'refresh-token',
      { email: 'new@example.com', name: 'New User', avatarUrl: 'https://avatar.url' }
    )

    expect(result.id).toBe('user-1')
    expect(mockRunHook).toHaveBeenCalledWith('onUserCreated', expect.objectContaining({
      method: 'oauth',
    }))
  })

  it('updates user name/avatar when not set on existing user', async () => {
    setupMultiSelectChains([
      [],
      [{ ...mockDbUser, name: null, avatarUrl: null }],
      [mockDbUser],
    ])
    setupInsertChain()

    await handleOAuthCallback(
      'google',
      'google-456',
      'access-token',
      null,
      { email: 'test@example.com', name: 'OAuth Name', avatarUrl: 'https://new-avatar.url' }
    )

    expect(mockUpdate).toHaveBeenCalled()
  })
})
