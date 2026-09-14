import { eq } from 'drizzle-orm'
import { getDb } from '../db/client'
import { subscriptions } from '../db/schema/subscriptions'
import { getStripe } from './customer'
import { getSubscription } from './getSubscription'
import { getPlanById } from './plans'
import { runHook } from '../runtime/hookRunner'
import { AppError } from '../errors/types'

export async function changePlan(
  userId: string,
  newPlanId: string,
  interval: 'monthly' | 'yearly' = 'monthly'
): Promise<void> {
  const db = getDb()
  const stripe = getStripe()

  // Route through getSubscription rather than repeating a bare LIMIT 1. A user
  // can now hold several rows — webhook handling keys on
  // stripe_subscription_id so a second subscription no longer overwrites the
  // first — and an unordered LIMIT 1 picked in heap order. That could act on a
  // cancelled row (silently doing nothing) or on the wrong live subscription.
  const sub = await getSubscription(userId)

  if (!sub?.stripeSubscriptionId) {
    throw new AppError('NO_SUBSCRIPTION', 'No active subscription found', 400)
  }

  const newPlan = getPlanById(newPlanId)
  const priceId = newPlan.stripePriceId[interval]
  if (!priceId) {
    throw new AppError('INVALID_PLAN', `No price configured for ${newPlanId}`, 400)
  }

  const stripeSubscription = await stripe.subscriptions.retrieve(
    sub.stripeSubscriptionId
  )

  await stripe.subscriptions.update(sub.stripeSubscriptionId, {
    items: [
      {
        id: stripeSubscription.items.data[0].id,
        price: priceId,
      },
    ],
    proration_behavior: 'create_prorations',
  })

  const oldPlan = sub.plan

  await db
    .update(subscriptions)
    .set({
      plan: newPlanId,
      stripePriceId: priceId,
      interval,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.id, sub.id))

  void runHook('onSubscriptionChanged', {
    userId,
    oldPlan,
    newPlan: newPlanId,
    subscription: sub,
  })
}
