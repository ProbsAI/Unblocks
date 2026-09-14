import Stripe from 'stripe'
import { eq } from 'drizzle-orm'
import { getDb } from '../db/client'
import { subscriptions } from '../db/schema/subscriptions'
import { claimEvent, releaseEvent } from './webhookEventLog'
import { getStripe } from './customer'
import { runHook } from '../runtime/hookRunner'
import { getAllPlans } from './plans'
import { encryptNullable } from '../security/encryption'

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

  // Idempotency gate. Stripe retries on any non-2xx, and a retry must not
  // re-apply a plan change or re-fire a payment hook.
  if (await claimEvent(event.id, 'stripe', event.type)) return

  try {
    await dispatch(event)
  } catch (err) {
    // Release the claim so Stripe's retry can run this event again.
    //
    // Without this the ledger row survives the failure, the retry short-circuits
    // at the gate above and returns 2xx, and the event is dropped permanently —
    // converting every transient error (and the deliberate throw in
    // handleSubscriptionUpdate for an unlinkable customer) into the exact silent
    // data loss this handler exists to prevent.
    await releaseEvent(event.id)
    throw err
  }
}

async function dispatch(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    // The primary provisioning event. Without this, a first-time subscriber
    // completes payment and nothing grants them access.
    case 'checkout.session.completed': {
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
      break
    }

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
      // Only subscription invoices. A one-off or manually issued invoice would
      // otherwise fire the payment hook with an empty plan.
      if (!invoiceSubscriptionId(invoice)) break

      const userId = await resolveUserId(customerIdOf(invoice.customer))
      await runHook('onPaymentSucceeded', {
        userId: userId ?? '',
        amount: (invoice.amount_paid ?? 0) / 100,
        plan: await planForInvoice(invoice),
        invoiceUrl: invoice.hosted_invoice_url,
      })
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      const userId = await resolveUserId(customerIdOf(invoice.customer))
      await runHook('onPaymentFailed', {
        userId: userId ?? '',
        amount: (invoice.amount_due ?? 0) / 100,
        error: 'Payment failed',
      })
      break
    }
  }
}

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session
): Promise<void> {
  const subscriptionId =
    typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id

  // One-off (non-subscription) checkouts have nothing to provision here.
  if (!subscriptionId) return

  const stripe = getStripe()
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)

  // Link the user from the session itself: the subscription row may not exist
  // yet for a first-time subscriber. createCheckoutSession stores the id in
  // metadata and does not set client_reference_id, so metadata is the path that
  // actually fires; client_reference_id is accepted for sessions created
  // elsewhere.
  const userIdHint =
    session.client_reference_id ?? session.metadata?.userId ?? null

  await handleSubscriptionUpdate(subscription, userIdHint)
}

async function handleSubscriptionUpdate(
  stripeSubscription: Stripe.Subscription,
  userIdHint?: string | null
): Promise<void> {
  const db = getDb()
  const customerId = customerIdOf(stripeSubscription.customer)

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

  const period = periodBounds(stripeSubscription)

  const subData = {
    stripeSubscriptionId: stripeSubscription.id,
    stripeSubscriptionIdEncrypted: encryptNullable(stripeSubscription.id),
    stripePriceId: priceId,
    plan: planId,
    status: stripeSubscription.status,
    interval:
      stripeSubscription.items.data[0]?.price.recurring?.interval ?? null,
    currentPeriodStart: period.start,
    currentPeriodEnd: period.end,
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
    return
  }

  // No local row for this customer yet — a first-time subscriber, or a row that
  // was never created. Previously this event was dropped silently and the
  // customer paid without ever receiving entitlement.
  const userId = userIdHint ?? (await resolveUserId(customerId))

  if (!userId) {
    // Throwing returns a non-2xx so Stripe retries rather than treating the
    // event as delivered. Never swallow an unlinkable paid subscription.
    throw new Error(
      `Cannot link Stripe customer ${customerId} to a user; subscription ${stripeSubscription.id} not applied`
    )
  }

  await db.insert(subscriptions).values({
    userId,
    stripeCustomerId: customerId,
    ...subData,
  })
}

async function handleSubscriptionDeleted(
  stripeSubscription: Stripe.Subscription
): Promise<void> {
  const db = getDb()
  const customerId = customerIdOf(stripeSubscription.customer)

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

/**
 * The subscription an invoice belongs to, or null for a one-off invoice.
 *
 * Stripe moved this from `invoice.subscription` onto
 * `invoice.parent.subscription_details.subscription` in the 2025 API versions,
 * so check both rather than pinning to one shape.
 */
function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const legacy = (invoice as unknown as { subscription?: string | { id: string } })
    .subscription
  if (legacy) return typeof legacy === 'string' ? legacy : legacy.id

  const nested = (
    invoice as unknown as {
      parent?: { subscription_details?: { subscription?: string | { id: string } } }
    }
  ).parent?.subscription_details?.subscription
  if (nested) return typeof nested === 'string' ? nested : nested.id

  return null
}

function customerIdOf(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null
): string {
  if (!customer) return ''
  return typeof customer === 'string' ? customer : customer.id
}

/**
 * Map a Stripe customer to a local user id.
 *
 * Prefers the local subscriptions row, then falls back to the Stripe customer's
 * metadata, which getOrCreateCustomer stamps with the user id at creation time.
 */
async function resolveUserId(customerId: string): Promise<string | null> {
  if (!customerId) return null
  const db = getDb()

  const [row] = await db
    .select({ userId: subscriptions.userId })
    .from(subscriptions)
    .where(eq(subscriptions.stripeCustomerId, customerId))
    .limit(1)

  if (row?.userId) return row.userId

  const stripe = getStripe()
  const customer = await stripe.customers.retrieve(customerId)
  if (customer.deleted) return null

  return customer.metadata?.userId ?? null
}

async function planForInvoice(invoice: Stripe.Invoice): Promise<string> {
  const priceId = invoice.lines?.data[0]?.price?.id
  if (!priceId) return ''
  const match = getAllPlans().find(
    (p) =>
      p.stripePriceId.monthly === priceId || p.stripePriceId.yearly === priceId
  )
  return match?.id ?? ''
}

/**
 * Read the billing period bounds.
 *
 * Stripe moved current_period_start/end from the subscription onto its items in
 * API version 2025-03-31.basil. Read the item first and fall back to the
 * subscription so this keeps working whichever version the account is pinned to.
 */
function periodBounds(subscription: Stripe.Subscription): {
  start: Date | null
  end: Date | null
} {
  const item = subscription.items.data[0] as
    | { current_period_start?: number; current_period_end?: number }
    | undefined
  const legacy = subscription as unknown as {
    current_period_start?: number
    current_period_end?: number
  }

  const startUnix = item?.current_period_start ?? legacy.current_period_start
  const endUnix = item?.current_period_end ?? legacy.current_period_end

  return {
    start: typeof startUnix === 'number' ? new Date(startUnix * 1000) : null,
    end: typeof endUnix === 'number' ? new Date(endUnix * 1000) : null,
  }
}
