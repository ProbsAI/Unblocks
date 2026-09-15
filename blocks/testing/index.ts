/**
 * Testing Block — Public API
 *
 * Re-exports all testing utilities for convenient imports.
 *
 * Usage:
 *   import { createTestUser, assertSuccessResponse, buildRequest } from '@unblocks/blocks/testing'
 */

// Factories
export {
  createTestUser,
  createTestAdmin,
  createTestTeam,
  createTestNotification,
  createTestJob,
  createMany,
  resetFactories,
} from './factories'

// Assertions
export {
  assertSuccessResponse,
  assertErrorResponse,
  assertHasFields,
  assertRecentDate,
  assertUUID,
  assertSortedBy,
  assertEmailSent,
} from './assertions'

// Mocks
export {
  createEmailMock,
  createStripeMock,
  createHookSpy,
  createConfigMock,
} from './mocks'

// Fixtures
export {
  singleUser,
  adminUser,
  teamWithMembers,
  userWithNotifications,
  jobQueue,
  fullOrganization,
} from './fixtures'

// Request helpers
export {
  buildRequest,
  buildContext,
  buildAuthenticatedRequest,
} from './request'

// Stripe webhook fixtures — shared because vi.mock factories hoist per file
// and cannot be, which is what forces webhook suites to split by concern.
export {
  stripeNow,
  buildStripeSubscription,
  stripeEvent,
} from './stripeFixtures'

// Types
export type {
  Factory,
  AsyncFactory,
  MockConfig,
  TestContext,
  TestUser,
  TestTeam,
  TestNotification,
  TestJob,
} from './types'

export type { EmailMock, StripeMock, HookSpy } from './mocks'
