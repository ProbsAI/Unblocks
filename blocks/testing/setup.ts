/**
 * Testing Block — Global Test Setup
 *
 * Runs before all tests. Sets up environment variables,
 * mocks external services, and initializes test state.
 */

// Set test environment variables
;(process.env as Record<string, string>).NODE_ENV = 'test'
process.env.APP_URL = 'http://localhost:3000'
process.env.SESSION_SECRET = 'test-secret-key-at-least-32-characters-long'
process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://localhost:5432/unblocks_test'
