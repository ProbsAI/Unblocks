# Testing Block

Shared testing utilities for the Unblocks framework. Provides factories, fixtures, mocks, assertions, and request helpers to make writing tests fast and consistent.

## Quick Start

```typescript
import { describe, it, expect } from 'vitest'
import {
  createTestUser,
  createTestTeam,
  buildRequest,
  buildContext,
  assertSuccessResponse,
} from '@unblocks/blocks/testing'

describe('my feature', () => {
  it('creates a user', () => {
    const user = createTestUser({ email: 'custom@test.com' })
    expect(user.email).toBe('custom@test.com')
  })
})
```

## Factories

Create test entities with sensible defaults. Override any field:

```typescript
import { createTestUser, createTestTeam, createMany } from '@unblocks/blocks/testing'

const user = createTestUser()                    // all defaults
const admin = createTestAdmin()                  // isAdmin: true
const team = createTestTeam({ name: 'My Team' }) // custom name
const users = createMany(createTestUser, 10)     // 10 users
```

## Fixtures

Pre-built scenarios for common test setups:

```typescript
import { teamWithMembers, fullOrganization, jobQueue } from '@unblocks/blocks/testing'

const { owner, members, team } = teamWithMembers()
const org = fullOrganization()  // admin, owner, members, team, notifications, jobs
const { pendingJobs, failedJob } = jobQueue()
```

## Assertions

Domain-specific assertions with clear error messages:

```typescript
import { assertSuccessResponse, assertErrorResponse, assertUUID } from '@unblocks/blocks/testing'

const data = await assertSuccessResponse(response, 201)
await assertErrorResponse(response, 400, 'VALIDATION_ERROR')
assertUUID(data.id)
```

## Mocks

Mock implementations for external services:

```typescript
import { createEmailMock, createStripeMock, createHookSpy } from '@unblocks/blocks/testing'

const emailMock = createEmailMock()
emailMock.failNext()  // next send will throw
// ... run code ...
expect(emailMock.getSentEmails()).toHaveLength(1)

const hookSpy = createHookSpy()
expect(hookSpy.wasCalled('onUserCreated')).toBe(true)
```

## Request Helpers

Build Request objects for testing route handlers:

```typescript
import { buildRequest, buildContext, buildAuthenticatedRequest } from '@unblocks/blocks/testing'

const req = buildRequest('/api/auth/login', {
  method: 'POST',
  body: { email: 'test@test.com', password: 'password' },
})

const ctx = buildContext({ id: 'team-123' })
const authReq = buildAuthenticatedRequest('/api/teams', 'session-token')
```

## Adding Your Own

Extend the testing block by adding files to `blocks/testing/`:
- Add factories for your custom entities
- Add fixtures for your test scenarios
- Add mocks for your external integrations
- Re-export from `index.ts`
