import { describe, it, expect } from 'vitest'
import { BillingConfigSchema } from './types'

/**
 * The "two plans must never share a Stripe price id" rule.
 *
 * It was documented and unenforced, which is the worst combination: the
 * failure is silent. `planIdForPrice()` returns the first match, so a
 * subscription event carrying no Checkout metadata grants whichever plan
 * happens to be listed first — a Business purchase provisioned as Pro, with
 * nothing logged and nothing thrown. The shipped config made this reachable,
 * since its Pro and Business placeholders were identical.
 */

function plan(
  id: string,
  stripePriceId: { monthly: string | null; yearly: string | null }
) {
  return {
    id,
    name: id,
    price: { monthly: 10, yearly: 100 },
    stripePriceId,
    limits: {
      projects: 1,
      teamMembers: 1,
      storageGb: 1,
      apiRequestsPerDay: 1,
      apiKeys: 1,
    },
    features: [],
  }
}

describe('BillingConfigSchema — price id uniqueness', () => {
  it('rejects two plans sharing a monthly price id', () => {
    const result = BillingConfigSchema.safeParse({
      plans: [
        plan('pro', { monthly: 'price_same', yearly: 'price_pro_year' }),
        plan('business', { monthly: 'price_same', yearly: 'price_biz_year' }),
      ],
    })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toMatch(/price_same/)
    // The message has to name both plans, or the operator cannot find them.
    expect(result.error?.issues[0].message).toMatch(/pro/)
    expect(result.error?.issues[0].message).toMatch(/business/)
  })

  it('rejects a collision across the monthly/yearly boundary', () => {
    // Uniqueness is per price id, not per interval: planIdForPrice checks both
    // fields, so a monthly id reused as another plan's yearly id is just as
    // ambiguous.
    const result = BillingConfigSchema.safeParse({
      plans: [
        plan('pro', { monthly: 'price_x', yearly: null }),
        plan('business', { monthly: null, yearly: 'price_x' }),
      ],
    })

    expect(result.success).toBe(false)
  })

  it('rejects one plan reusing the same id for both intervals', () => {
    const result = BillingConfigSchema.safeParse({
      plans: [plan('pro', { monthly: 'price_x', yearly: 'price_x' })],
    })

    expect(result.success).toBe(false)
  })

  it('allows null price ids on any number of plans', () => {
    // Free plans legitimately have none, and nulls are not a collision.
    const result = BillingConfigSchema.safeParse({
      plans: [
        plan('free', { monthly: null, yearly: null }),
        plan('community', { monthly: null, yearly: null }),
        plan('pro', { monthly: 'price_pro', yearly: 'price_pro_year' }),
      ],
    })

    expect(result.success).toBe(true)
  })

  it('accepts distinct price ids', () => {
    const result = BillingConfigSchema.safeParse({
      plans: [
        plan('pro', { monthly: 'price_pro_m', yearly: 'price_pro_y' }),
        plan('business', { monthly: 'price_biz_m', yearly: 'price_biz_y' }),
      ],
    })

    expect(result.success).toBe(true)
  })

  it('accepts the shipped configuration', () => {
    // The default export is what every new install runs, so a collision there
    // would ship the bug to everyone.
    expect(BillingConfigSchema.safeParse({}).success).toBe(true)
  })
})
