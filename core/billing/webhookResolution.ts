import Stripe from 'stripe'
import { eq, and, or, isNull, lte, type SQL } from 'drizzle-orm'
import { getDb } from '../db/client'
import { subscriptions } from '../db/schema/subscriptions'
import { getStripe } from './customer'
import { getAllPlans } from './plans'
import {
  invoiceSubscriptionId,
  customerIdOf,
  planIdForPrice,
  planForInvoice,
} from './stripeShapes'

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
 *     wherever two plans shared a price id, which the shipped config did, so a
 *     Business purchase was persisted as Pro. BillingConfigSchema now rejects
 *     duplicate price ids outright; this ordering is the second line of
 *     defence, and the one that still holds for a config loaded before that
 *     check existed.
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
 * Find the row already holding a Stripe subscription.
 *
 * Keyed on the SUBSCRIPTION id, never the customer. Matching by customer meant
 * a customer's second subscription overwrote the row holding their first.
 */
export async function findSubscriptionRow(
  subscriptionId: string
): Promise<{ id: string } | null> {
  const db = getDb()

  const [row] = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, subscriptionId))
    .limit(1)

  return row ?? null
}

/**
 * Take over the placeholder row `getOrCreateCustomer` writes — customer linked,
 * nothing subscribed yet — applying this subscription's data to it.
 *
 * Returns false when there is no placeholder, or when another delivery claimed
 * it first; the caller then inserts instead.
 *
 * **The `IS NULL` in the UPDATE's WHERE is the claim, and it has to be there.**
 * Selecting a placeholder and then updating it by id is not atomic: two
 * first-time subscription events for the same customer both see the same null
 * row, both write to it, and one paid subscription silently disappears.
 * Postgres re-checks the predicate after taking the row lock, so exactly one
 * of them matches and the loser falls through to its own insert.
 */
export async function claimPlaceholderRow(
  customerId: string,
  subData: Partial<typeof subscriptions.$inferInsert>
): Promise<boolean> {
  const db = getDb()

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

  if (!placeholder) return false

  const claimed = await db
    .update(subscriptions)
    .set(subData)
    .where(
      and(
        eq(subscriptions.id, placeholder.id),
        // Re-asserted, not assumed: this is the atomic part.
        isNull(subscriptions.stripeSubscriptionId)
      )
    )
    .returning({ id: subscriptions.id })

  return claimed.length > 0
}

/**
 * Only apply a write when no newer provider event has already landed.
 *
 * Expressed as a SQL predicate rather than a read-then-compare so concurrent
 * deliveries cannot both pass the check before either writes. Stripe does not
 * promise delivery order, and without this an older subscription snapshot
 * arriving late rolls plan and status back to stale values.
 *
 * **Known limit: `Stripe.Event.created` has one-second resolution.** Two events
 * created within the same second compare equal, `lte` admits both, and the
 * later-delivered one wins regardless of which is newer. Stripe exposes no
 * per-event revision number to key on, so this is a real gap rather than an
 * oversight — it narrows the window from unbounded to one second, it does not
 * close it. Reconciling against the Stripe API would.
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
 * The plan an invoice is for, or throw.
 *
 * The local subscription row first — it is the authoritative record of what
 * this customer is on — then the invoice's price mapping, which covers the
 * first invoice arriving before provisioning has landed.
 *
 * Throwing if neither resolves is deliberate, and matches resolvePlan: the
 * previous behaviour returned '' and fired onPaymentSucceeded with a blank
 * plan, which is worse than failing because it looks like an answer. A non-2xx
 * makes Stripe retry and surfaces the gap.
 */
export async function requireInvoicePlan(
  invoice: Stripe.Invoice
): Promise<string> {
  const subscriptionId = invoiceSubscriptionId(invoice)

  // The local row first, not the invoice line.
  //
  // An invoice carries several lines on a plan change or a multi-item
  // subscription, and the first is often a proration for the plan being left.
  // Mapping that line reports the OLD plan as the one just paid for — a
  // plausible-looking answer, which is worse than none. The subscription row is
  // what the provisioning path already agreed on.
  if (subscriptionId) {
    const db = getDb()
    const [row] = await db
      .select({ plan: subscriptions.plan })
      .from(subscriptions)
      .where(eq(subscriptions.stripeSubscriptionId, subscriptionId))
      .limit(1)

    if (row?.plan) return row.plan
  }

  // No local row yet — a first invoice can arrive before provisioning lands.
  const fromPrice = planForInvoice(invoice)
  if (fromPrice) return fromPrice

  throw new Error(
    `Cannot resolve a plan for invoice ${invoice.id}; no local subscription row matches and its price is not configured`
  )
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
