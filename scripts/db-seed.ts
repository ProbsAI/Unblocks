/**
 * Database Seed Script
 *
 * Run with: npm run db:seed
 * Populates the database with sample data for development.
 */
import { seed } from '../blocks/seed'

async function main(): Promise<void> {
  console.log('[seed] Starting database seed...')

  const result = await seed({
    userCount: 20,
    adminCount: 2,
    teamCount: 5,
    maxMembersPerTeam: 8,
    notificationsPerUser: 10,
    jobCount: 30,
    fileCount: 15,
    clearFirst: true,
  })

  console.log('[seed] Complete!')
  console.log(`  Users:         ${result.users}`)
  console.log(`  Admins:        ${result.admins}`)
  console.log(`  Teams:         ${result.teams}`)
  console.log(`  Team members:  ${result.teamMembers}`)
  console.log(`  Notifications: ${result.notifications}`)
  console.log(`  Jobs:          ${result.jobs}`)
  console.log(`  Files:         ${result.files}`)
  console.log(`  Duration:      ${result.duration}ms`)

  process.exit(0)
}

main().catch((err) => {
  console.error('[seed] Failed:', err)
  process.exit(1)
})
