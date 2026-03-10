import Stripe from 'stripe'
import { eq } from 'drizzle-orm'
import { getDb } from '../db/client'
import { subscriptions } from '../db/schema/subscriptions'
import { getStripe } from './customer'
import { runHook } from '../runtime/hookRunner'
import { getAllPlans } from './plans'

export async function handleStripeWebhook(
  payload: string,
  signature: string
): Promise<void> {
  const stripe = getStripe()
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET is required')
  }

  const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret)

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      await handleSubscriptionUpdate(event.data.object as Stripe.Subscription)
      break
    }

    case 'customer.subscription.deleted': {
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
      break
    }

    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice
      if (invoice.subscription) {
        void runHook('onPaymentSucceeded', {
          userId: invoice.metadata?.userId ?? '',
          amount: (invoice.amount_paid ?? 0) / 100,
          plan: invoice.metadata?.planId ?? '',
          invoiceUrl: invoice.hosted_invoice_url,
        })
      }
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      void runHook('onPaymentFailed', {
        userId: invoice.metadata?.userId ?? '',
        amount: (invoice.amount_due ?? 0) / 100,
        error: 'Payment failed',
      })
      break
    }
  }
}

async function handleSubscriptionUpdate(
  stripeSubscription: Stripe.Subscription
): Promise<void> {
  const db = getDb()
  const customerId =
    typeof stripeSubscription.customer === 'string'
      ? stripeSubscription.customer
      : stripeSubscription.customer.id

  const [existing] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeCustomerId, customerId))
    .limit(1)

  const priceId = stripeSubscription.items.data[0]?.price.id ?? null
  // Fall back to first paid plan in config rather than hardcoding 'pro'
  const firstPaidPlan = getAllPlans().find((p) => p.price.monthly > 0)
  const planId =
    stripeSubscription.items.data[0]?.price.metadata?.planId ??
    firstPaidPlan?.id ??
    'pro'

  const subData = {
    stripeSubscriptionId: stripeSubscription.id,
    stripePriceId: priceId,
    plan: planId,
    status: stripeSubscription.status,
    interval:
      stripeSubscription.items.data[0]?.price.recurring?.interval ?? null,
    currentPeriodStart: new Date(
      stripeSubscription.current_period_start * 1000
    ),
    currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
    cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
    trialEnd: stripeSubscription.trial_end
      ? new Date(stripeSubscription.trial_end * 1000)
      : null,
    updatedAt: new Date(),
  }

  if (existing) {
    await db
      .update(subscriptions)
      .set(subData)
      .where(eq(subscriptions.id, existing.id))
  }
}

async function handleSubscriptionDeleted(
  stripeSubscription: Stripe.Subscription
): Promise<void> {
  const db = getDb()
  const customerId =
    typeof stripeSubscription.customer === 'string'
      ? stripeSubscription.customer
      : stripeSubscription.customer.id

  await db
    .update(subscriptions)
    .set({
      status: 'canceled',
      plan: 'free',
      cancelAtPeriodEnd: false,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.stripeCustomerId, customerId))
}
