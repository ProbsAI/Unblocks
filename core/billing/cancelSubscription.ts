import { eq } from 'drizzle-orm'
import { getDb } from '../db/client'
import { subscriptions } from '../db/schema/subscriptions'
import { getStripe } from './customer'
import { getSubscription } from './getSubscription'
import { AppError } from '../errors/types'

export async function cancelSubscription(
  userId: string,
  immediate: boolean = false
): Promise<void> {
  const db = getDb()
  const stripe = getStripe()

  // Route through getSubscription rather than repeating a bare LIMIT 1. A user
  // can now hold several rows — webhook handling keys on
  // stripe_subscription_id so a second subscription no longer overwrites the
  // first — and an unordered LIMIT 1 picked in heap order. That could act on a
  // cancelled row (silently doing nothing) or on the wrong live subscription.
  const sub = await getSubscription(userId)

  // getSubscription falls back to the newest CANCELLED row when a user has no
  // live one, so the id alone is not proof there is anything to act on —
  // without this we would ask Stripe to cancel an already-cancelled
  // subscription instead of reporting that there is none.
  if (!sub?.stripeSubscriptionId || sub.status === 'canceled') {
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
