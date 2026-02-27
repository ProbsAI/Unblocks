import { describe, it, expect, beforeEach } from 'vitest'
import {
  createTestUser,
  createTestAdmin,
  createTestTeam,
  createTestNotification,
  createTestJob,
  createMany,
  resetFactories,
} from './factories'

describe('createTestUser', () => {
  beforeEach(() => {
    resetFactories()
  })

  it('creates a user with default values', () => {
    const user = createTestUser()

    expect(user.id).toBeDefined()
    expect(user.email).toContain('@test.com')
    expect(user.name).toContain('Test User')
    expect(user.passwordHash).toBeDefined()
    expect(user.emailVerified).toBe(true)
    expect(user.isAdmin).toBe(false)
    expect(user.createdAt).toBeInstanceOf(Date)
    expect(user.updatedAt).toBeInstanceOf(Date)
  })

  it('allows overriding specific fields', () => {
    const user = createTestUser({
      email: 'custom@example.com',
      name: 'Custom Name',
      isAdmin: true,
    })

    expect(user.email).toBe('custom@example.com')
    expect(user.name).toBe('Custom Name')
    expect(user.isAdmin).toBe(true)
    // Non-overridden fields should still have defaults
    expect(user.emailVerified).toBe(true)
  })

  it('generates unique IDs for each user', () => {
    const user1 = createTestUser()
    const user2 = createTestUser()

    expect(user1.id).not.toBe(user2.id)
  })
})

describe('createTestAdmin', () => {
  beforeEach(() => {
    resetFactories()
  })

  it('creates a user with isAdmin true', () => {
    const admin = createTestAdmin()
    expect(admin.isAdmin).toBe(true)
  })

  it('allows overriding admin fields', () => {
    const admin = createTestAdmin({ email: 'admin@custom.com' })
    expect(admin.email).toBe('admin@custom.com')
    expect(admin.isAdmin).toBe(true)
  })
})

describe('createTestTeam', () => {
  beforeEach(() => {
    resetFactories()
  })

  it('creates a team with default values', () => {
    const team = createTestTeam()

    expect(team.id).toBeDefined()
    expect(team.name).toContain('Test Team')
    expect(team.slug).toContain('test-team')
    expect(team.ownerId).toBeDefined()
    expect(team.createdAt).toBeInstanceOf(Date)
  })

  it('allows overriding fields', () => {
    const team = createTestTeam({ name: 'My Team', ownerId: 'owner-abc' })

    expect(team.name).toBe('My Team')
    expect(team.ownerId).toBe('owner-abc')
  })
})

describe('createMany', () => {
  beforeEach(() => {
    resetFactories()
  })

  it('creates N items using the factory', () => {
    const users = createMany(createTestUser, 5)

    expect(users).toHaveLength(5)
    users.forEach((user) => {
      expect(user.id).toBeDefined()
      expect(user.email).toContain('@test.com')
    })
  })

  it('creates items with unique IDs', () => {
    const users = createMany(createTestUser, 3)
    const ids = users.map((u) => u.id)
    const uniqueIds = new Set(ids)

    expect(uniqueIds.size).toBe(3)
  })

  it('applies overrides to all created items', () => {
    const users = createMany(createTestUser, 3, { isAdmin: true })

    users.forEach((user) => {
      expect(user.isAdmin).toBe(true)
    })
  })

  it('creates zero items when count is 0', () => {
    const users = createMany(createTestUser, 0)
    expect(users).toHaveLength(0)
  })

  it('works with different factories', () => {
    const teams = createMany(createTestTeam, 4)
    expect(teams).toHaveLength(4)
    teams.forEach((team) => {
      expect(team.slug).toBeDefined()
    })

    const notifications = createMany(createTestNotification, 2)
    expect(notifications).toHaveLength(2)

    const jobs = createMany(createTestJob, 3)
    expect(jobs).toHaveLength(3)
    jobs.forEach((job) => {
      expect(job.status).toBe('pending')
    })
  })
})

describe('resetFactories', () => {
  it('resets the counter so IDs restart', () => {
    resetFactories()
    const user1 = createTestUser()
    // The ID includes the counter, so after reset + one creation it should be test-1-*
    expect(user1.id).toMatch(/^test-1-/)

    resetFactories()
    const user2 = createTestUser()
    // After another reset, the counter restarts
    expect(user2.id).toMatch(/^test-1-/)
  })
})
