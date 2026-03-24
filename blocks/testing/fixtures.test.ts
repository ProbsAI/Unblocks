import { describe, it, expect, beforeEach } from 'vitest'
import { resetFactories } from './factories'
import {
  singleUser,
  adminUser,
  teamWithMembers,
  userWithNotifications,
  jobQueue,
  fullOrganization,
} from './fixtures'

describe('fixtures', () => {
  beforeEach(() => {
    resetFactories()
  })

  describe('singleUser', () => {
    it('returns a user object', () => {
      const { user } = singleUser()

      expect(user).toBeDefined()
      expect(user.id).toBeDefined()
      expect(user.email).toBeDefined()
      expect(user.name).toBeDefined()
      expect(user.emailVerified).toBe(true)
      expect(user.isAdmin).toBe(false)
      expect(user.createdAt).toBeInstanceOf(Date)
      expect(user.updatedAt).toBeInstanceOf(Date)
    })
  })

  describe('adminUser', () => {
    it('returns admin with isAdmin true', () => {
      const { admin } = adminUser()

      expect(admin).toBeDefined()
      expect(admin.isAdmin).toBe(true)
      expect(admin.id).toBeDefined()
      expect(admin.email).toBeDefined()
    })
  })

  describe('teamWithMembers', () => {
    it('returns owner, 2 members, and team', () => {
      const { owner, members, team } = teamWithMembers()

      expect(owner).toBeDefined()
      expect(owner.name).toBe('Team Owner')

      expect(members).toHaveLength(2)
      expect(members[0].name).toBe('Member 1')
      expect(members[1].name).toBe('Member 2')

      expect(team).toBeDefined()
      expect(team.name).toBe('Fixture Team')
      expect(team.ownerId).toBe(owner.id)
    })
  })

  describe('userWithNotifications', () => {
    it('returns user with 3 unread and 2 read notifications', () => {
      const { user, unreadNotifications, readNotifications } = userWithNotifications()

      expect(user).toBeDefined()

      expect(unreadNotifications).toHaveLength(3)
      for (const n of unreadNotifications) {
        expect(n.read).toBe(false)
        expect(n.userId).toBe(user.id)
      }

      expect(readNotifications).toHaveLength(2)
      for (const n of readNotifications) {
        expect(n.read).toBe(true)
        expect(n.userId).toBe(user.id)
      }
    })
  })

  describe('jobQueue', () => {
    it('returns jobs in various states', () => {
      const { pendingJobs, processingJob, completedJob, failedJob } = jobQueue()

      expect(pendingJobs).toHaveLength(3)
      for (const j of pendingJobs) {
        expect(j.status).toBe('pending')
      }

      expect(processingJob.status).toBe('processing')
      expect(processingJob.attempts).toBe(1)

      expect(completedJob.status).toBe('completed')
      expect(completedJob.attempts).toBe(1)

      expect(failedJob.status).toBe('failed')
      expect(failedJob.attempts).toBe(3)
      expect(failedJob.maxRetries).toBe(3)
    })
  })

  describe('fullOrganization', () => {
    it('returns complete set of entities', () => {
      const { admin, owner, members, team, notifications, jobs } = fullOrganization()

      expect(admin).toBeDefined()
      expect(admin.isAdmin).toBe(true)

      expect(owner).toBeDefined()
      expect(owner.name).toBe('Org Owner')

      expect(members).toHaveLength(2)

      expect(team).toBeDefined()
      expect(team.ownerId).toBe(owner.id)

      expect(notifications).toHaveLength(2)
      expect(notifications[0].userId).toBe(owner.id)

      expect(jobs).toHaveLength(2)
      expect(jobs[0].status).toBe('completed')
      expect(jobs[1].status).toBe('pending')
    })
  })
})
