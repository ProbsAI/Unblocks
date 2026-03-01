/**
 * Testing Block — Type Definitions
 *
 * Shared types for the testing framework including factories,
 * fixtures, and mock configurations.
 */

/** Factory function that creates a test entity */
export type Factory<T> = (overrides?: Partial<T>) => T

/** Async factory for entities that need DB insertion */
export type AsyncFactory<T> = (overrides?: Partial<T>) => Promise<T>

/** Mock configuration for external services */
export interface MockConfig {
  stripe?: {
    checkoutSessionId?: string
    customerId?: string
    subscriptionId?: string
  }
  resend?: {
    shouldFail?: boolean
    sentEmails?: Array<{ to: string; subject: string; html: string }>
  }
  redis?: {
    store?: Map<string, string>
  }
}

/** Test context passed to setup/teardown helpers */
export interface TestContext {
  mockConfig: MockConfig
}

/** A test user with all fields populated */
export interface TestUser {
  id: string
  email: string
  name: string
  passwordHash: string
  emailVerified: boolean
  isAdmin: boolean
  createdAt: Date
  updatedAt: Date
}

/** A test team with members */
export interface TestTeam {
  id: string
  name: string
  slug: string
  ownerId: string
  createdAt: Date
}

/** A test notification */
export interface TestNotification {
  id: string
  userId: string
  category: string
  type: 'info' | 'success' | 'warning' | 'error'
  title: string
  body: string
  read: boolean
  createdAt: Date
}

/** A test job */
export interface TestJob {
  id: string
  type: string
  payload: Record<string, unknown>
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  priority: string
  attempts: number
  maxRetries: number
  createdAt: Date
}
