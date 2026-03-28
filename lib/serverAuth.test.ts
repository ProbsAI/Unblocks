import { describe, it, expect, vi, beforeEach } from 'vitest'
import { cookies, headers } from 'next/headers'
import { validateSession } from '@unblocks/core/auth'
import { validateApiKey } from '@unblocks/core/api-keys'
import { getCurrentUser, requireAuth } from './serverAuth'
import { AuthError } from '@unblocks/core/errors/types'

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
  headers: vi.fn(),
}))

vi.mock('@unblocks/core/auth', () => ({
  validateSession: vi.fn(),
}))

vi.mock('@unblocks/core/api-keys', () => ({
  validateApiKey: vi.fn(),
}))

vi.mock('@unblocks/core/security/cookies', () => ({
  SESSION_COOKIE_NAME: 'session',
}))

vi.mock('@unblocks/core/db/client', () => ({
  getDb: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{
            id: 'user-from-api-key',
            email: 'apikey@example.com',
            status: 'active',
          }]),
        }),
      }),
    }),
  }),
}))

vi.mock('@unblocks/core/db/schema/users', () => ({
  users: { id: 'id' },
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
}))

vi.mock('@unblocks/core/errors/types', () => {
  class MockAuthError extends Error {
    code: string
    statusCode: number
    constructor(code: string, message: string) {
      super(message)
      this.name = 'AuthError'
      this.code = code
      this.statusCode = 401
    }
  }
  return { AuthError: MockAuthError }
})

const mockCookies = cookies as ReturnType<typeof vi.fn>
const mockHeaders = headers as ReturnType<typeof vi.fn>
const mockValidateSession = validateSession as ReturnType<typeof vi.fn>
const mockValidateApiKey = validateApiKey as ReturnType<typeof vi.fn>

describe('serverAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: no cookies, no headers
    mockCookies.mockResolvedValue({
      get: vi.fn().mockReturnValue(undefined),
    })
    mockHeaders.mockResolvedValue({
      get: vi.fn().mockReturnValue(null),
    })
  })

  describe('getCurrentUser — session cookie auth', () => {
    it('returns user when session cookie is valid', async () => {
      const mockUser = { id: 'user-1', email: 'test@example.com' }
      mockCookies.mockResolvedValue({
        get: vi.fn().mockReturnValue({ value: 'valid-session-token' }),
      })
      mockValidateSession.mockResolvedValue({ user: mockUser })

      const user = await getCurrentUser()
      expect(user).toEqual(mockUser)
      expect(mockValidateSession).toHaveBeenCalledWith('valid-session-token')
    })

    it('returns null when no session cookie exists and no API key', async () => {
      const user = await getCurrentUser()
      expect(user).toBeNull()
      expect(mockValidateSession).not.toHaveBeenCalled()
    })

    it('returns null when validateSession returns null', async () => {
      mockCookies.mockResolvedValue({
        get: vi.fn().mockReturnValue({ value: 'expired-token' }),
      })
      mockValidateSession.mockResolvedValue(null)

      const user = await getCurrentUser()
      expect(user).toBeNull()
    })

    it('session cookie takes priority over API key', async () => {
      const sessionUser = { id: 'session-user', email: 'session@example.com' }
      mockCookies.mockResolvedValue({
        get: vi.fn().mockReturnValue({ value: 'valid-session' }),
      })
      mockValidateSession.mockResolvedValue({ user: sessionUser })
      mockHeaders.mockResolvedValue({
        get: vi.fn().mockReturnValue('ub_live_some_api_key'),
      })

      const user = await getCurrentUser()
      expect(user).toEqual(sessionUser)
      // API key validation should not be called when session succeeds
      expect(mockValidateApiKey).not.toHaveBeenCalled()
    })
  })

  describe('getCurrentUser — API key auth', () => {
    it('returns user when API key is valid and no session cookie', async () => {
      mockHeaders.mockResolvedValue({
        get: vi.fn().mockReturnValue('ub_live_valid_key'),
      })
      mockValidateApiKey.mockResolvedValue({
        valid: true,
        userId: 'user-from-api-key',
        teamId: null,
        scopes: ['*'],
        apiKeyId: 'key-123',
      })

      const user = await getCurrentUser()
      expect(user).not.toBeNull()
      expect(user!.id).toBe('user-from-api-key')
      expect(mockValidateApiKey).toHaveBeenCalledWith('ub_live_valid_key')
    })

    it('returns null when API key is invalid', async () => {
      mockHeaders.mockResolvedValue({
        get: vi.fn().mockReturnValue('ub_live_bad_key'),
      })
      mockValidateApiKey.mockResolvedValue({
        valid: false,
        userId: null,
        teamId: null,
        scopes: [],
        apiKeyId: null,
      })

      const user = await getCurrentUser()
      expect(user).toBeNull()
    })

    it('returns null when no x-api-key header', async () => {
      const user = await getCurrentUser()
      expect(user).toBeNull()
      expect(mockValidateApiKey).not.toHaveBeenCalled()
    })
  })

  describe('requireAuth', () => {
    it('returns user when authenticated via session', async () => {
      const mockUser = { id: 'user-1', email: 'test@example.com' }
      mockCookies.mockResolvedValue({
        get: vi.fn().mockReturnValue({ value: 'valid-token' }),
      })
      mockValidateSession.mockResolvedValue({ user: mockUser })

      const user = await requireAuth()
      expect(user).toEqual(mockUser)
    })

    it('returns user when authenticated via API key', async () => {
      mockHeaders.mockResolvedValue({
        get: vi.fn().mockReturnValue('ub_live_valid_key'),
      })
      mockValidateApiKey.mockResolvedValue({
        valid: true,
        userId: 'user-from-api-key',
        teamId: null,
        scopes: ['*'],
        apiKeyId: 'key-123',
      })

      const user = await requireAuth()
      expect(user).not.toBeNull()
      expect(user.id).toBe('user-from-api-key')
    })

    it('throws AuthError when not authenticated by any method', async () => {
      await expect(requireAuth()).rejects.toThrow(AuthError)
    })
  })
})
