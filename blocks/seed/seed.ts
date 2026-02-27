/**
 * Seed Block — Main Seed Function
 *
 * Populates the database with realistic sample data for development.
 * Uses generators for deterministic, reproducible data.
 */
import { getDb } from '../../core/db/client'
import { users } from '../../core/db/schema/users'
import { teams, teamMembers } from '../../core/db/schema/teams'
import { notifications } from '../../core/db/schema/notifications'
import { jobs } from '../../core/db/schema/jobs'
import { files } from '../../core/db/schema/files'
import { sql } from 'drizzle-orm'
import type { SeedConfig, SeedResult } from './types'
import { SeedConfigSchema } from './types'
import {
  generateEmail,
  generateUserName,
  generateTeamName,
  generateTeamSlug,
  generateJobType,
  generateJobPayload,
  generateNotificationTitle,
  generateNotificationBody,
  generateNotificationCategory,
  generateFileName,
  generateFileMimeType,
  generateFileSize,
  resetSeedCounter,
} from './generators'

/**
 * Seed the database with sample data.
 * Returns a summary of what was created.
 */
export async function seed(rawConfig?: Partial<SeedConfig>): Promise<SeedResult> {
  const config = SeedConfigSchema.parse(rawConfig ?? {})
  const db = getDb()
  const start = Date.now()

  resetSeedCounter()

  // Clear existing data if requested
  if (config.clearFirst) {
    await db.execute(sql`TRUNCATE ${notifications}, ${jobs}, ${files}, ${teamMembers}, ${teams} CASCADE`)
    // Don't truncate users — may have foreign key constraints from sessions
  }

  // 1. Create users
  const userIds: string[] = []
  const totalUsers = config.userCount + config.adminCount

  for (let i = 0; i < totalUsers; i++) {
    const isAdmin = i < config.adminCount
    const [user] = await db
      .insert(users)
      .values({
        email: generateEmail(i),
        name: generateUserName(i),
        passwordHash: '$2a$12$seedhashedpasswordplaceholder.placeholder',
        emailVerified: true,
        isAdmin,
      })
      .returning({ id: users.id })

    userIds.push(user.id)
  }

  // 2. Create teams
  let totalTeamMembers = 0
  const teamIds: string[] = []

  for (let i = 0; i < config.teamCount && i < userIds.length; i++) {
    const ownerId = userIds[i % userIds.length]

    const [team] = await db
      .insert(teams)
      .values({
        name: generateTeamName(i),
        slug: generateTeamSlug(i),
        ownerId,
      })
      .returning({ id: teams.id })

    teamIds.push(team.id)

    // Add owner as member
    await db.insert(teamMembers).values({
      teamId: team.id,
      userId: ownerId,
      role: 'owner',
    })
    totalTeamMembers++

    // Add random members
    const memberCount = Math.min(
      config.maxMembersPerTeam - 1,
      Math.floor(Math.random() * (config.maxMembersPerTeam - 1)) + 1
    )

    for (let m = 0; m < memberCount; m++) {
      const memberId = userIds[(i + m + 1) % userIds.length]
      if (memberId === ownerId) continue

      try {
        await db.insert(teamMembers).values({
          teamId: team.id,
          userId: memberId,
          role: m === 0 ? 'admin' : 'member',
        })
        totalTeamMembers++
      } catch {
        // Skip duplicate members
      }
    }
  }

  // 3. Create notifications
  let totalNotifications = 0
  for (const userId of userIds) {
    for (let n = 0; n < config.notificationsPerUser; n++) {
      const title = generateNotificationTitle()
      await db.insert(notifications).values({
        userId,
        category: generateNotificationCategory(),
        type: ['info', 'success', 'warning', 'error'][n % 4],
        title,
        body: generateNotificationBody(title),
        read: n < config.notificationsPerUser / 2,
      })
      totalNotifications++
    }
  }

  // 4. Create jobs
  const statuses = ['pending', 'processing', 'completed', 'failed', 'cancelled'] as const
  for (let i = 0; i < config.jobCount; i++) {
    const type = generateJobType()
    await db.insert(jobs).values({
      type,
      payload: generateJobPayload(type),
      status: statuses[i % statuses.length],
      priority: ['critical', 'high', 'normal', 'low'][i % 4],
      attempts: i % 3,
      maxRetries: 3,
    })
  }

  // 5. Create files
  for (let i = 0; i < config.fileCount; i++) {
    const name = generateFileName(i)
    await db.insert(files).values({
      userId: userIds[i % userIds.length],
      filename: name,
      originalName: name,
      mimeType: generateFileMimeType(name),
      size: generateFileSize(),
      storageProvider: 'local',
      storagePath: `/uploads/seed/${name}`,
    })
  }

  return {
    users: config.userCount,
    admins: config.adminCount,
    teams: config.teamCount,
    teamMembers: totalTeamMembers,
    notifications: totalNotifications,
    jobs: config.jobCount,
    files: config.fileCount,
    duration: Date.now() - start,
  }
}
