import { eq, desc, sql } from 'drizzle-orm'
import { getDb } from '../db/client'
import { subscriptions } from '../db/schema/subscriptions'
import { users } from '../db/schema/users'
import type { AdminSubscription } from './types'

/**
 * List all subscriptions with user info.
 */
export async function listSubscriptions(options?: {
  limit?: number
  offset?: number
  status?: string
}): Promise<{ subscriptions: AdminSubscription[]; total: number }> {
  const db = getDb()
  const limit = options?.limit ?? 50
  const offset = options?.offset ?? 0

  let query = db
    .select({
      subscription: subscriptions,
      userEmail: users.email,
    })
    .from(subscriptions)
    .innerJoin(users, eq(subscriptions.userId, users.id))

  let countQuery = db
    .select({ count: sql<number>`count(*)` })
    .from(subscriptions)

  if (options?.status) {
    query = query.where(eq(subscriptions.status, options.status)) as typeof query
    countQuery = countQuery.where(eq(subscriptions.status, options.status)) as typeof countQuery
  }

  const rows = await query
    .orderBy(desc(subscriptions.createdAt))
    .limit(limit)
    .offset(offset)

  const [countResult] = await countQuery

  return {
    subscriptions: rows.map((row) => ({
      id: row.subscription.id,
      userId: row.subscription.userId,
      userEmail: row.userEmail,
      plan: row.subscription.plan,
      status: row.subscription.status,
      interval: row.subscription.interval,
      currentPeriodEnd: row.subscription.currentPeriodEnd,
      cancelAtPeriodEnd: row.subscription.cancelAtPeriodEnd,
      createdAt: row.subscription.createdAt,
    })),
    total: countResult.count,
  }
}
