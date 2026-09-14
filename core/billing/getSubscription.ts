import { eq, desc } from 'drizzle-orm'
import { getDb } from '../db/client'
import { subscriptions } from '../db/schema/subscriptions'
import type { Subscription } from './types'

/**
 * The subscription to treat as a user's current one.
 *
 * A user can hold more than one row: webhook handling keys on
 * `stripe_subscription_id` rather than the customer, precisely so a second
 * subscription does not overwrite the first. That makes "the" subscription
 * ambiguous, and a bare `LIMIT 1` resolved it in heap order — a cancelled row
 * could shadow a live one, and which you got could change between calls.
 *
 * Rule: the newest row that is not cancelled, else the newest row. Deterministic
 * and stable. Anything that must act on a *specific* subscription (cancel,
 * change plan) should take its id rather than rely on this.
 */
export async function getSubscription(
  userId: string
): Promise<Subscription | null> {
  const db = getDb()

  const rows = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .orderBy(desc(subscriptions.createdAt))

  const sub = rows.find((row) => row.status !== 'canceled') ?? rows[0]

  if (!sub) return null

  return {
    id: sub.id,
    userId: sub.userId,
    stripeCustomerId: sub.stripeCustomerId,
    stripeSubscriptionId: sub.stripeSubscriptionId,
    stripePriceId: sub.stripePriceId,
    plan: sub.plan,
    status: sub.status,
    interval: sub.interval,
    currentPeriodStart: sub.currentPeriodStart,
    currentPeriodEnd: sub.currentPeriodEnd,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    trialEnd: sub.trialEnd,
    createdAt: sub.createdAt,
    updatedAt: sub.updatedAt,
  }
}
