import { sql, eq, gte, and } from 'drizzle-orm'
import { getDb } from '../db/client'
import { users } from '../db/schema/users'
import { subscriptions } from '../db/schema/subscriptions'
import { teams } from '../db/schema/teams'
import { getAllPlans } from '../billing/plans'
import type { AdminMetrics } from './types'

/**
 * Compute the average monthly price across all paid plans from config.
 */
export function getAveragePaidPlanPrice(): number {
  const plans = getAllPlans()
  const paidPlans = plans.filter((p) => p.price.monthly > 0)
  if (paidPlans.length === 0) return 0
  const total = paidPlans.reduce((sum, p) => sum + p.price.monthly, 0)
  return total / paidPlans.length
}

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

  // MRR estimate using average paid plan price from billing config
  const avgPrice = getAveragePaidPlanPrice()
  const mrr = paidCount.count * avgPrice

  return {
    totalUsers: userCount.count,
    activeUsers30d: activeCount.count,
    totalSubscriptions: subCount.count,
    paidSubscriptions: paidCount.count,
    mrr,
    totalTeams: teamCount.count,
  }
}
