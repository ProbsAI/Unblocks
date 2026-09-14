/**
 * Stripe object fixtures for webhook tests.
 *
 * Pure builders, deliberately free of `vi.mock`: mock factories hoist per file
 * and cannot be shared, but plain fixtures can. Keeping them here is what lets
 * the webhook suites split by concern instead of growing into one file.
 */

/** Seconds since the epoch, the unit Stripe stamps on events and periods. */
export function stripeNow(): number {
  return Math.floor(Date.now() / 1000)
}

/**
 * A Stripe subscription as a webhook delivers it.
 *
 * `planId` lands in `price.metadata.planId`; pass null to omit it, which is how
 * you exercise the "price maps to no configured plan" path. Period bounds are
 * set on the item rather than the subscription, matching API version
 * 2025-03-31.basil onward — `periodBounds` reads both.
 */
export function buildStripeSubscription(
  overrides: Record<string, unknown> = {},
  planId: string | null = 'pro',
  priceId = 'price_test_1',
  now: number = stripeNow()
): Record<string, unknown> {
  return {
    id: 'sub_a',
    customer: 'cus_1',
    status: 'active',
    cancel_at_period_end: false,
    trial_end: null,
    items: {
      data: [
        {
          price: {
            id: priceId,
            metadata: planId ? { planId } : {},
            recurring: { interval: 'month' },
          },
          current_period_start: now,
          current_period_end: now + 30 * 24 * 3600,
        },
      ],
    },
    ...overrides,
  }
}

/**
 * A webhook payload.
 *
 * `created` matters: the handler carries it into `subscriptions.last_event_at`
 * and uses it to discard snapshots that arrive out of order, so a test about
 * ordering controls it explicitly.
 */
export function stripeEvent(
  type: string,
  object: Record<string, unknown>,
  id: string,
  created: number = stripeNow()
): string {
  return JSON.stringify({ id, type, created, data: { object } })
}
