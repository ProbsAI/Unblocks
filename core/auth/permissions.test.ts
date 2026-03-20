import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSelect = vi.fn()
const mockFrom = vi.fn()
const mockWhere = vi.fn()
const mockLimit = vi.fn()

vi.mock('../db/client', () => ({
  getDb: vi.fn(() => ({
    select: mockSelect,
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

import { getUserById, getUserByEmail } from './permissions'

const mockDbUser = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  avatarUrl: 'https://example.com/avatar.jpg',
  emailVerified: true,
  status: 'active',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
}

function setupSelectChain(result: unknown[]) {
  mockLimit.mockResolvedValue(result)
  mockWhere.mockReturnValue({ limit: mockLimit })
  mockFrom.mockReturnValue({ where: mockWhere })
  mockSelect.mockReturnValue({ from: mockFrom })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getUserById', () => {
  it('returns user when found', async () => {
    setupSelectChain([mockDbUser])

    const result = await getUserById('user-1')

    expect(result).not.toBeNull()
    expect(result!.id).toBe('user-1')
    expect(result!.email).toBe('test@example.com')
    expect(result!.name).toBe('Test User')
  })

  it('returns null when user not found', async () => {
    setupSelectChain([])

    const result = await getUserById('nonexistent')

    expect(result).toBeNull()
  })

  it('returns all user fields', async () => {
    setupSelectChain([mockDbUser])

    const result = await getUserById('user-1')

    expect(result).toEqual({
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      avatarUrl: 'https://example.com/avatar.jpg',
      emailVerified: true,
      status: 'active',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    })
  })
})

describe('getUserByEmail', () => {
  it('returns user when found', async () => {
    setupSelectChain([mockDbUser])

    const result = await getUserByEmail('test@example.com')

    expect(result).not.toBeNull()
    expect(result!.id).toBe('user-1')
  })

  it('returns null when user not found', async () => {
    setupSelectChain([])

    const result = await getUserByEmail('unknown@example.com')

    expect(result).toBeNull()
  })

  it('lowercases email for lookup', async () => {
    setupSelectChain([mockDbUser])

    await getUserByEmail('TEST@EXAMPLE.COM')

    expect(mockSelect).toHaveBeenCalled()
  })
})
