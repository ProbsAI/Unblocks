import { describe, it, expect, vi, beforeEach } from 'vitest'
import { cookies } from 'next/headers'
import { validateSession } from '@unblocks/core/auth'
import { getCurrentUser, requireAuth } from './serverAuth'
import { AuthError } from '@unblocks/core/errors/types'

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}))

vi.mock('@unblocks/core/auth', () => ({
  validateSession: vi.fn(),
}))

vi.mock('@unblocks/core/security/cookies', () => ({
  SESSION_COOKIE_NAME: 'session',
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
const mockValidateSession = validateSession as ReturnType<typeof vi.fn>

describe('serverAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getCurrentUser', () => {
    it('returns user when session is valid', async () => {
      const mockUser = { id: 'user-1', email: 'test@example.com' }
      mockCookies.mockResolvedValue({
        get: vi.fn().mockReturnValue({ value: 'valid-session-token' }),
      })
      mockValidateSession.mockResolvedValue({ user: mockUser })

      const user = await getCurrentUser()
      expect(user).toEqual(mockUser)
      expect(mockValidateSession).toHaveBeenCalledWith('valid-session-token')
    })

    it('returns null when no session cookie exists', async () => {
      mockCookies.mockResolvedValue({
        get: vi.fn().mockReturnValue(undefined),
      })

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
  })

  describe('requireAuth', () => {
    it('returns user when authenticated', async () => {
      const mockUser = { id: 'user-1', email: 'test@example.com' }
      mockCookies.mockResolvedValue({
        get: vi.fn().mockReturnValue({ value: 'valid-token' }),
      })
      mockValidateSession.mockResolvedValue({ user: mockUser })

      const user = await requireAuth()
      expect(user).toEqual(mockUser)
    })

    it('throws AuthError when not authenticated', async () => {
      mockCookies.mockResolvedValue({
        get: vi.fn().mockReturnValue(undefined),
      })

      await expect(requireAuth()).rejects.toThrow(AuthError)
    })
  })
})
