/**
 * Testing Block — Entity Factories
 *
 * Factory functions for creating test entities with sensible defaults.
 * Use `overrides` to customize specific fields.
 *
 * Usage:
 *   const user = createTestUser({ email: 'custom@test.com' })
 *   const team = createTestTeam({ ownerId: user.id })
 */
import type {
  TestUser,
  TestTeam,
  TestNotification,
  TestJob,
  Factory,
} from './types'

let counter = 0
function nextId(): string {
  counter++
  return `test-${counter}-${Date.now()}`
}

/** Reset the ID counter (call in beforeEach if needed) */
export function resetFactories(): void {
  counter = 0
}

/** Create a test user with sensible defaults */
export const createTestUser: Factory<TestUser> = (overrides = {}) => ({
  id: nextId(),
  email: `user-${counter}@test.com`,
  name: `Test User ${counter}`,
  passwordHash: '$2a$12$testhashedpasswordplaceholder',
  emailVerified: true,
  isAdmin: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

/** Create a test admin user */
export const createTestAdmin: Factory<TestUser> = (overrides = {}) =>
  createTestUser({ isAdmin: true, name: `Test Admin ${counter}`, ...overrides })

/** Create a test team */
export const createTestTeam: Factory<TestTeam> = (overrides = {}) => ({
  id: nextId(),
  name: `Test Team ${counter}`,
  slug: `test-team-${counter}`,
  ownerId: `owner-${counter}`,
  createdAt: new Date(),
  ...overrides,
})

/** Create a test notification */
export const createTestNotification: Factory<TestNotification> = (overrides = {}) => ({
  id: nextId(),
  userId: `user-${counter}`,
  category: 'general',
  type: 'info',
  title: `Test Notification ${counter}`,
  body: `This is test notification ${counter}`,
  read: false,
  createdAt: new Date(),
  ...overrides,
})

/** Create a test job */
export const createTestJob: Factory<TestJob> = (overrides = {}) => ({
  id: nextId(),
  type: 'test-job',
  payload: { test: true },
  status: 'pending',
  priority: 'normal',
  attempts: 0,
  maxRetries: 3,
  createdAt: new Date(),
  ...overrides,
})

/** Create multiple entities at once */
export function createMany<T>(factory: Factory<T>, count: number, overrides?: Partial<T>): T[] {
  return Array.from({ length: count }, () => factory(overrides))
}
