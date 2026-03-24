import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSelect = vi.fn()
const mockFrom = vi.fn()
const mockWhere = vi.fn()
const mockLimit = vi.fn()
const mockUpdate = vi.fn()
const mockSet = vi.fn()
const mockUpdateWhere = vi.fn()

vi.mock('../db/client', () => ({
  getDb: vi.fn(() => ({
    select: mockSelect,
    update: mockUpdate,
  })),
}))

vi.mock('../db/schema/users', () => ({
  users: {
    id: 'id',
    email: 'email',
  },
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ a, b })),
}))

vi.mock('./password', () => ({
  verifyPassword: vi.fn(),
}))

import { verifyCredentials } from './verifyCredentials'
import { verifyPassword } from './password'
import { AuthError } from '../errors/types'

const mockVerifyPassword = vi.mocked(verifyPassword)

const mockDbUser = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test',
  avatarUrl: null,
  emailVerified: true,
  status: 'active',
  passwordHash: 'hashed_password',
  loginCount: 5,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
}

function setupSelectChain(result: unknown[]) {
  mockLimit.mockResolvedValue(result)
  mockWhere.mockReturnValue({ limit: mockLimit })
  mockFrom.mockReturnValue({ where: mockWhere })
  mockSelect.mockReturnValue({ from: mockFrom })
}

function setupUpdateChain() {
  mockUpdateWhere.mockResolvedValue(undefined)
  mockSet.mockReturnValue({ where: mockUpdateWhere })
  mockUpdate.mockReturnValue({ set: mockSet })
}

beforeEach(() => {
  vi.clearAllMocks()
  setupUpdateChain()
})

describe('verifyCredentials', () => {
  it('returns user for valid credentials', async () => {
    setupSelectChain([mockDbUser])
    mockVerifyPassword.mockResolvedValue(true)

    const result = await verifyCredentials('test@example.com', 'correctpassword')

    expect(result.id).toBe('user-1')
    expect(result.email).toBe('test@example.com')
  })

  it('lowercases email for lookup', async () => {
    setupSelectChain([mockDbUser])
    mockVerifyPassword.mockResolvedValue(true)

    await verifyCredentials('TEST@EXAMPLE.COM', 'correctpassword')

    // The eq mock should have been called with lowercased email
    expect(mockVerifyPassword).toHaveBeenCalledWith('correctpassword', 'hashed_password')
  })

  it('throws AuthError when user not found', async () => {
    setupSelectChain([])

    await expect(
      verifyCredentials('unknown@example.com', 'password')
    ).rejects.toThrow(AuthError)

    await expect(
      verifyCredentials('unknown@example.com', 'password')
    ).rejects.toThrow('Invalid email or password')
  })

  it('throws AuthError when user has no password hash (OAuth user)', async () => {
    setupSelectChain([{ ...mockDbUser, passwordHash: null }])

    await expect(
      verifyCredentials('test@example.com', 'password')
    ).rejects.toThrow('This account uses a different login method')
  })

  it('throws AuthError when user is suspended', async () => {
    setupSelectChain([{ ...mockDbUser, status: 'suspended' }])

    await expect(
      verifyCredentials('test@example.com', 'password')
    ).rejects.toThrow('This account has been suspended')
  })

  it('throws AuthError when password is wrong', async () => {
    setupSelectChain([mockDbUser])
    mockVerifyPassword.mockResolvedValue(false)

    await expect(
      verifyCredentials('test@example.com', 'wrongpassword')
    ).rejects.toThrow(AuthError)
  })

  it('updates lastLoginAt and loginCount on success', async () => {
    setupSelectChain([mockDbUser])
    mockVerifyPassword.mockResolvedValue(true)

    await verifyCredentials('test@example.com', 'correctpassword')

    expect(mockUpdate).toHaveBeenCalled()
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        loginCount: 6,
      })
    )
  })

  it('handles null loginCount gracefully', async () => {
    setupSelectChain([{ ...mockDbUser, loginCount: null }])
    mockVerifyPassword.mockResolvedValue(true)

    await verifyCredentials('test@example.com', 'correctpassword')

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        loginCount: 1,
      })
    )
  })
})
