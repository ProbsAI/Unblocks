import { eq } from 'drizzle-orm'
import { getDb } from '../db/client'
import { subscriptions } from '../db/schema/subscriptions'
import { getStripe } from './customer'
import { AppError } from '../errors/types'

export async function cancelSubscription(
  userId: string,
  immediate: boolean = false
): Promise<void> {
  const db = getDb()
  const stripe = getStripe()

  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1)

  if (!sub?.stripeSubscriptionId) {
    throw new AppError('NO_SUBSCRIPTION', 'No active subscription found', 400)
  }

  if (immediate) {
    await stripe.subscriptions.cancel(sub.stripeSubscriptionId)
    await db
      .update(subscriptions)
      .set({ status: 'canceled', plan: 'free', updatedAt: new Date() })
      .where(eq(subscriptions.id, sub.id))
  } else {
    await stripe.subscriptions.update(sub.stripeSubscriptionId, {
      cancel_at_period_end: true,
    })
    await db
      .update(subscriptions)
      .set({ cancelAtPeriodEnd: true, updatedAt: new Date() })
      .where(eq(subscriptions.id, sub.id))
  }
}
