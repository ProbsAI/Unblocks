import Stripe from 'stripe'
import { eq, and, or, isNull, lte, type SQL } from 'drizzle-orm'
import { getDb } from '../db/client'
import { subscriptions } from '../db/schema/subscriptions'
import { getStripe } from './customer'
import { getAllPlans } from './plans'
import { invoiceSubscriptionId, customerIdOf, planIdForPrice } from './stripeShapes'

/**
 * Lookup and resolution helpers for the Stripe webhook handler.
 *
 * Split out of handleWebhook.ts to keep that file about *what to do* with an
 * event, and to keep both under the 300-line limit.
 */

/**
 * Resolve which configured plan a subscription grants, or throw.
 *
 * Order matters, and the previous order was wrong in both directions:
 *
 *  1. `planHint` — the plan the user actually selected, read back from the
 *     signed Checkout Session metadata. Resolving the price first went wrong
 *     wherever two plans share a price id, which the shipped config does (its
 *     placeholders are identical), persisting a Business purchase as Pro.
 *  2. The configured price mapping.
 *  3. `price.metadata.planId`, for deployments that map on the Stripe side.
 *
 * Both hints are validated against the configured plans: they are
 * operator-supplied strings, and a stale or mistyped one must not create an
 * entitlement to a plan that does not exist.
 *
 * Nothing resolves -> throw. The old fallback was "first paid plan, else pro",
 * which silently granted a paid tier for a price nobody had configured. A
 * non-2xx makes Stripe retry and surfaces the misconfiguration in the
 * dashboard, which is the failure mode you want when the alternative is
 * guessing what somebody bought.
 */
export function resolvePlan(
  priceId: string | null,
  planHint: string | null | undefined,
  metadataPlanId: string | null | undefined,
  subscriptionId: string
): string {
  const configured = (id: string | null | undefined): string | null =>
    id && getAllPlans().some((p) => p.id === id) ? id : null

  const resolved =
    configured(planHint) ?? planIdForPrice(priceId) ?? configured(metadataPlanId)

  if (!resolved) {
    throw new Error(
      `Cannot map Stripe price ${priceId ?? '(none)'} on subscription ${subscriptionId} to a configured plan; add it to billing.config.ts`
    )
  }

  return resolved
}

/**
 * Find the row a Stripe subscription belongs to.
 *
 * Keyed on the SUBSCRIPTION id, not the customer. Matching by customer meant a
 * customer's second subscription overwrote the row holding their first.
 */
export async function findSubscriptionRow(
  customerId: string,
  subscriptionId: string
): Promise<{ id: string } | null> {
  const db = getDb()

  const [bySubscription] = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, subscriptionId))
    .limit(1)

  if (bySubscription) return bySubscription

  // Adopt the placeholder getOrCreateCustomer writes: customer linked, nothing
  // subscribed yet. Only a row carrying NO subscription id may be adopted —
  // taking one that already holds a different subscription is the overwrite
  // this function exists to prevent.
  const [placeholder] = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.stripeCustomerId, customerId),
        isNull(subscriptions.stripeSubscriptionId)
      )
    )
    .limit(1)

  return placeholder ?? null
}

/**
 * Only apply a write when no newer provider event has already landed.
 *
 * Expressed as a SQL predicate rather than a read-then-compare so concurrent
 * deliveries cannot both pass the check before either writes. Stripe does not
 * promise delivery order, and without this an older subscription snapshot
 * arriving late rolls plan and status back to stale values.
 */
export function notStale(eventAt: Date): SQL | undefined {
  return or(
    isNull(subscriptions.lastEventAt),
    lte(subscriptions.lastEventAt, eventAt)
  )
}

/** A one-off or manually issued invoice has no subscription to act on. */
export function isSubscriptionInvoice(invoice: Stripe.Invoice): boolean {
  return invoiceSubscriptionId(invoice) !== null
}

/**
 * Resolve the user behind a subscription invoice, or throw.
 *
 * Throwing matters because the event was already claimed by the idempotency
 * gate. Returning normally acknowledges the delivery with a 2xx, so a transient
 * lookup failure would suppress the payment hook permanently. Throwing releases
 * the claim and lets Stripe retry — the same contract handleSubscriptionUpdate
 * uses for an unlinkable subscription.
 */
export async function requireInvoiceUser(
  invoice: Stripe.Invoice
): Promise<string> {
  const customerId = customerIdOf(invoice.customer)
  const userId = await resolveUserId(customerId)

  if (!userId) {
    throw new Error(
      `Cannot link Stripe customer ${customerId} to a user; invoice ${invoice.id} not applied`
    )
  }

  return userId
}

/**
 * Map a Stripe customer to a local user id.
 *
 * Prefers the local subscriptions row, then falls back to the Stripe customer's
 * metadata, which getOrCreateCustomer stamps with the user id at creation time.
 */
export async function resolveUserId(
  customerId: string
): Promise<string | null> {
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
