import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSelect = vi.fn()
const mockFrom = vi.fn()
const mockWhere = vi.fn()
const mockLimit = vi.fn()
const mockInsert = vi.fn()
const mockValues = vi.fn()
const mockReturning = vi.fn()

vi.mock('../db/client', () => ({
  getDb: vi.fn(() => ({
    select: mockSelect,
    insert: mockInsert,
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
  hashPassword: vi.fn().mockResolvedValue('hashed_password_123'),
}))

vi.mock('../runtime/hookRunner', () => ({
  runHook: vi.fn().mockResolvedValue(undefined),
}))

import { createUser } from './createUser'
import { hashPassword } from './password'
import { runHook } from '../runtime/hookRunner'
import { ConflictError, ValidationError } from '../errors/types'

const mockHashPassword = vi.mocked(hashPassword)
const mockRunHook = vi.mocked(runHook)

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  avatarUrl: null,
  emailVerified: false,
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

function setupInsertChain() {
  mockReturning.mockResolvedValue([mockUser])
  mockValues.mockReturnValue({ returning: mockReturning })
  mockInsert.mockReturnValue({ values: mockValues })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('createUser', () => {
  it('creates a user with email and password', async () => {
    setupSelectChain([])
    setupInsertChain()

    const result = await createUser({
      email: 'Test@Example.com',
      password: 'mypassword123',
    })

    expect(result.id).toBe('user-1')
    expect(result.email).toBe('test@example.com')
    expect(mockHashPassword).toHaveBeenCalledWith('mypassword123')
  })

  it('creates a user without password (OAuth)', async () => {
    setupSelectChain([])
    setupInsertChain()

    const result = await createUser({
      email: 'oauth@example.com',
      name: 'OAuth User',
    })

    expect(result.id).toBe('user-1')
    expect(mockHashPassword).not.toHaveBeenCalled()
  })

  it('throws ConflictError if email already exists', async () => {
    setupSelectChain([{ id: 'existing-user' }])

    await expect(
      createUser({ email: 'existing@example.com', password: 'password123' })
    ).rejects.toThrow(ConflictError)
  })

  it('throws ValidationError if password is too short', async () => {
    setupSelectChain([])

    await expect(
      createUser({ email: 'test@example.com', password: 'short' })
    ).rejects.toThrow(ValidationError)
  })

  it('fires onUserCreated hook with email method when password provided', async () => {
    setupSelectChain([])
    setupInsertChain()

    await createUser({ email: 'test@example.com', password: 'password123' })

    expect(mockRunHook).toHaveBeenCalledWith('onUserCreated', {
      user: expect.objectContaining({ id: 'user-1' }),
      method: 'email',
    })
  })

  it('fires onUserCreated hook with oauth method when no password', async () => {
    setupSelectChain([])
    setupInsertChain()

    await createUser({ email: 'test@example.com' })

    expect(mockRunHook).toHaveBeenCalledWith('onUserCreated', {
      user: expect.objectContaining({ id: 'user-1' }),
      method: 'oauth',
    })
  })

  it('lowercases email before inserting', async () => {
    setupSelectChain([])
    setupInsertChain()

    await createUser({ email: 'TEST@EXAMPLE.COM', password: 'password123' })

    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'test@example.com' })
    )
  })

  it('passes name and avatarUrl when provided', async () => {
    setupSelectChain([])
    setupInsertChain()

    await createUser({
      email: 'test@example.com',
      name: 'John Doe',
      avatarUrl: 'https://example.com/avatar.jpg',
    })

    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'John Doe',
        avatarUrl: 'https://example.com/avatar.jpg',
      })
    )
  })

  it('defaults emailVerified to false', async () => {
    setupSelectChain([])
    setupInsertChain()

    await createUser({ email: 'test@example.com' })

    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ emailVerified: false })
    )
  })

  it('respects emailVerified override', async () => {
    setupSelectChain([])
    setupInsertChain()

    await createUser({ email: 'test@example.com', emailVerified: true })

    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ emailVerified: true })
    )
  })
})
