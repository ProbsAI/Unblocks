/**
 * Testing Block — Fixtures
 *
 * Pre-built data sets for common test scenarios.
 * Each fixture returns a consistent, predictable set of entities.
 *
 * Usage:
 *   const { users, teams, notifications } = fixtures.fullOrganization()
 */
import {
  createTestUser,
  createTestAdmin,
  createTestTeam,
  createTestNotification,
  createTestJob,
} from './factories'
import type { TestUser, TestTeam, TestNotification, TestJob } from './types'

/** A single user with no team or notifications */
export function singleUser(overrides?: Partial<TestUser>): {
  user: TestUser
} {
  return { user: createTestUser(overrides) }
}

/** An admin user */
export function adminUser(overrides?: Partial<TestUser>): {
  admin: TestUser
} {
  return { admin: createTestAdmin(overrides) }
}

/** A team with an owner and 2 members */
export function teamWithMembers(): {
  owner: TestUser
  members: TestUser[]
  team: TestTeam
} {
  const owner = createTestUser({ name: 'Team Owner' })
  const member1 = createTestUser({ name: 'Member 1' })
  const member2 = createTestUser({ name: 'Member 2' })
  const team = createTestTeam({ ownerId: owner.id, name: 'Fixture Team' })

  return {
    owner,
    members: [member1, member2],
    team,
  }
}

/** A user with unread and read notifications */
export function userWithNotifications(): {
  user: TestUser
  unreadNotifications: TestNotification[]
  readNotifications: TestNotification[]
} {
  const user = createTestUser()
  const unread = [
    createTestNotification({ userId: user.id, type: 'info', read: false }),
    createTestNotification({ userId: user.id, type: 'warning', read: false }),
    createTestNotification({ userId: user.id, type: 'success', read: false }),
  ]
  const read = [
    createTestNotification({ userId: user.id, type: 'info', read: true }),
    createTestNotification({ userId: user.id, type: 'info', read: true }),
  ]

  return {
    user,
    unreadNotifications: unread,
    readNotifications: read,
  }
}

/** A set of jobs in various states */
export function jobQueue(): {
  pendingJobs: TestJob[]
  processingJob: TestJob
  completedJob: TestJob
  failedJob: TestJob
} {
  return {
    pendingJobs: [
      createTestJob({ type: 'send-email', status: 'pending', priority: 'high' }),
      createTestJob({ type: 'process-upload', status: 'pending', priority: 'normal' }),
      createTestJob({ type: 'cleanup', status: 'pending', priority: 'low' }),
    ],
    processingJob: createTestJob({ type: 'long-task', status: 'processing', attempts: 1 }),
    completedJob: createTestJob({ type: 'done-task', status: 'completed', attempts: 1 }),
    failedJob: createTestJob({ type: 'broken-task', status: 'failed', attempts: 3, maxRetries: 3 }),
  }
}

/** A full organization: admin, team with members, notifications, and jobs */
export function fullOrganization(): {
  admin: TestUser
  owner: TestUser
  members: TestUser[]
  team: TestTeam
  notifications: TestNotification[]
  jobs: TestJob[]
} {
  const admin = createTestAdmin({ name: 'Org Admin' })
  const owner = createTestUser({ name: 'Org Owner' })
  const member1 = createTestUser({ name: 'Org Member 1' })
  const member2 = createTestUser({ name: 'Org Member 2' })
  const team = createTestTeam({ ownerId: owner.id, name: 'Main Org' })

  return {
    admin,
    owner,
    members: [member1, member2],
    team,
    notifications: [
      createTestNotification({ userId: owner.id, category: 'teams', title: 'New member joined' }),
      createTestNotification({ userId: member1.id, category: 'general', title: 'Welcome' }),
    ],
    jobs: [
      createTestJob({ type: 'send-welcome-email', status: 'completed' }),
      createTestJob({ type: 'process-avatar', status: 'pending' }),
    ],
  }
}
