import { sql, eq, gte, and } from 'drizzle-orm'
import { getDb } from '../db/client'
import { users } from '../db/schema/users'
import { subscriptions } from '../db/schema/subscriptions'
import { teams } from '../db/schema/teams'
import type { AdminMetrics } from './types'

/**
 * Get system-wide admin metrics.
 */
export async function getMetrics(): Promise<AdminMetrics> {
  const db = getDb()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const [userCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(users)

  const [activeCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(gte(users.lastLoginAt, thirtyDaysAgo))

  const [subCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(subscriptions)

  const [paidCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.status, 'active'),
        sql`${subscriptions.plan} != 'free'`
      )
    )

  const [teamCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(teams)

  // MRR calculation is approximate — real MRR comes from Stripe
  // This counts paid active subscriptions and estimates based on plan config
  const mrr = paidCount.count * 29 // Rough estimate using Pro plan price

  return {
    totalUsers: userCount.count,
    activeUsers30d: activeCount.count,
    totalSubscriptions: subCount.count,
    paidSubscriptions: paidCount.count,
    mrr,
    totalTeams: teamCount.count,
  }
}
