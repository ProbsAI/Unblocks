import Stripe from 'stripe'
import { claimEvent, releaseEvent } from './webhookEventLog'
import { getStripe } from './customer'
import { runHook } from '../runtime/hookRunner'
import {
  isSubscriptionInvoice,
  requireInvoiceUser,
  requireInvoicePlan,
} from './webhookResolution'
import {
  handleSubscriptionUpdate,
  handleSubscriptionDeleted,
} from './subscriptionWrites'

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
  // Stripe does not promise delivery order. Carrying the event's creation time
  // into the write lets a stale snapshot be recognised and skipped instead of
  // rolling a subscription back to an older plan or status.
  const at = eventTime(event)

  switch (event.type) {
    // The primary provisioning event. Without this, a first-time subscriber
    // completes payment and nothing grants them access.
    case 'checkout.session.completed': {
      await handleCheckoutCompleted(
        event.data.object as Stripe.Checkout.Session,
        at
      )
      break
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      await handleSubscriptionUpdate(
        event.data.object as Stripe.Subscription,
        at
      )
      break
    }

    case 'customer.subscription.deleted': {
      await handleSubscriptionDeleted(
        event.data.object as Stripe.Subscription,
        at
      )
      break
    }

    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice
      if (!isSubscriptionInvoice(invoice)) break

      await runHook('onPaymentSucceeded', {
        userId: await requireInvoiceUser(invoice),
        amount: (invoice.amount_paid ?? 0) / 100,
        plan: await requireInvoicePlan(invoice),
        invoiceUrl: invoice.hosted_invoice_url,
      })
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      // The success path filtered one-off invoices; this one did not, so a
      // manually issued charge triggered dunning for a non-subscription.
      if (!isSubscriptionInvoice(invoice)) break

      await runHook('onPaymentFailed', {
        userId: await requireInvoiceUser(invoice),
        amount: (invoice.amount_due ?? 0) / 100,
        error: 'Payment failed',
      })
      break
    }
  }
}

/** Stripe stamps `created` in seconds; fall back to now if it is absent. */
function eventTime(event: Stripe.Event): Date {
  return typeof event.created === 'number'
    ? new Date(event.created * 1000)
    : new Date()
}

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  eventAt: Date
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

  await handleSubscriptionUpdate(
    subscription,
    eventAt,
    userIdHint,
    session.metadata?.planId ?? null
  )
}
