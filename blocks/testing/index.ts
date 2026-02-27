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
