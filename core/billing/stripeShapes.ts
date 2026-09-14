import Stripe from 'stripe'
import { getAllPlans } from './plans'

/**
 * Pure readers for Stripe object shapes.
 *
 * Kept separate from handleWebhook so the handler stays about *what to do* with
 * an event rather than how to dig a value out of whichever API version produced
 * it, and so these can be unit-tested without any webhook plumbing.
 */

/**
 * The subscription an invoice belongs to, or null for a one-off invoice.
 *
 * Stripe moved this from `invoice.subscription` onto
 * `invoice.parent.subscription_details.subscription` in the 2025 API versions,
 * so check both rather than pinning to one shape.
 */
export function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
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

export function customerIdOf(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null
): string {
  if (!customer) return ''
  return typeof customer === 'string' ? customer : customer.id
}


/**
 * Map a Stripe price id to a configured plan id, or null when unknown.
 */
export function planIdForPrice(priceId: string | null): string | null {
  if (!priceId) return null
  const match = getAllPlans().find(
    (p) =>
      p.stripePriceId.monthly === priceId || p.stripePriceId.yearly === priceId
  )
  return match?.id ?? null
}

export function planForInvoice(invoice: Stripe.Invoice): string {
  return planIdForPrice(invoice.lines?.data[0]?.price?.id ?? null) ?? ''
}

/**
 * Read the billing period bounds.
 *
 * Stripe moved current_period_start/end from the subscription onto its items in
 * API version 2025-03-31.basil. Read the item first and fall back to the
 * subscription so this keeps working whichever version the account is pinned to.
 */
export function periodBounds(subscription: Stripe.Subscription): {
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
