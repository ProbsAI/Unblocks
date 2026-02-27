import { eq } from 'drizzle-orm'
import { getDb } from '../db/client'
import { subscriptions } from '../db/schema/subscriptions'
import type { Subscription } from './types'

export async function getSubscription(
  userId: string
): Promise<Subscription | null> {
  const db = getDb()

  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1)

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
