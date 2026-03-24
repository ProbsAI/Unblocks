import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSelect = vi.fn()
const mockFrom = vi.fn()
const mockWhere = vi.fn()
const mockLimit = vi.fn()
const mockUpdate = vi.fn()
const mockSet = vi.fn()
const mockUpdateWhere = vi.fn()

const mockConstructEvent = vi.fn()

vi.mock('../db/client', () => ({
  getDb: vi.fn(() => ({
    select: mockSelect,
    update: mockUpdate,
  })),
}))

vi.mock('../db/schema/subscriptions', () => ({
  subscriptions: {
    id: 'id',
    stripeCustomerId: 'stripeCustomerId',
  },
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ a, b })),
}))

vi.mock('./customer', () => ({
  getStripe: vi.fn(() => ({
    webhooks: {
      constructEvent: mockConstructEvent,
    },
  })),
}))

vi.mock('../runtime/hookRunner', () => ({
  runHook: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('./plans', () => ({
  getAllPlans: vi.fn().mockReturnValue([
    { id: 'free', price: { monthly: 0 } },
    { id: 'pro', price: { monthly: 20 } },
  ]),
}))

import { handleStripeWebhook } from './handleWebhook'
import { runHook } from '../runtime/hookRunner'

const mockRunHook = vi.mocked(runHook)

function setupSelectChain(result: unknown[]) {
  mockLimit.mockResolvedValue(result)
  mockWhere.mockReturnValue({ limit: mockLimit })
  mockFrom.mockReturnValue({ where: mockWhere })
  mockSelect.mockReturnValue({ from: mockFrom })
}

function setupUpdateChain() {
  mockUpdateWhere.mockResolvedValue(undefined)
  mockSet.mockReturnValue({ where: mockUpdateWhere })
  mockUpdate.mockReturnValue({ set: mockSet })
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_123'
  setupUpdateChain()
})

describe('handleStripeWebhook', () => {
  it('throws when STRIPE_WEBHOOK_SECRET is not set', async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET

    await expect(
      handleStripeWebhook('payload', 'sig')
    ).rejects.toThrow('STRIPE_WEBHOOK_SECRET is required')
  })

  it('handles customer.subscription.created event', async () => {
    setupSelectChain([{ id: 'sub-1' }])

    mockConstructEvent.mockReturnValue({
      type: 'customer.subscription.created',
      data: {
        object: {
          id: 'sub_stripe_new',
          customer: 'cus_123',
          status: 'active',
          current_period_start: 1704067200,
          current_period_end: 1706745600,
          cancel_at_period_end: false,
          trial_end: null,
          items: {
            data: [{
              price: {
                id: 'price_pro_m',
                metadata: { planId: 'pro' },
                recurring: { interval: 'month' },
              },
            }],
          },
        },
      },
    })

    await handleStripeWebhook('payload', 'sig')

    expect(mockUpdate).toHaveBeenCalled()
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        stripeSubscriptionId: 'sub_stripe_new',
        plan: 'pro',
        status: 'active',
      })
    )
  })

  it('handles customer.subscription.updated event', async () => {
    setupSelectChain([{ id: 'sub-1' }])

    mockConstructEvent.mockReturnValue({
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_stripe_updated',
          customer: 'cus_456',
          status: 'active',
          current_period_start: 1704067200,
          current_period_end: 1706745600,
          cancel_at_period_end: true,
          trial_end: null,
          items: {
            data: [{
              price: {
                id: 'price_ent_m',
                metadata: {},
                recurring: { interval: 'month' },
              },
            }],
          },
        },
      },
    })

    await handleStripeWebhook('payload', 'sig')

    expect(mockUpdate).toHaveBeenCalled()
  })

  it('handles customer.subscription.deleted event', async () => {
    mockConstructEvent.mockReturnValue({
      type: 'customer.subscription.deleted',
      data: {
        object: {
          customer: 'cus_789',
        },
      },
    })

    await handleStripeWebhook('payload', 'sig')

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'canceled',
        plan: 'free',
        cancelAtPeriodEnd: false,
      })
    )
  })

  it('handles invoice.payment_succeeded event', async () => {
    mockConstructEvent.mockReturnValue({
      type: 'invoice.payment_succeeded',
      data: {
        object: {
          subscription: 'sub_123',
          metadata: { userId: 'user-1', planId: 'pro' },
          amount_paid: 2000,
          hosted_invoice_url: 'https://invoice.stripe.com/123',
        },
      },
    })

    await handleStripeWebhook('payload', 'sig')

    expect(mockRunHook).toHaveBeenCalledWith('onPaymentSucceeded', {
      userId: 'user-1',
      amount: 20,
      plan: 'pro',
      invoiceUrl: 'https://invoice.stripe.com/123',
    })
  })

  it('skips payment hook when no subscription on invoice', async () => {
    mockConstructEvent.mockReturnValue({
      type: 'invoice.payment_succeeded',
      data: {
        object: {
          subscription: null,
          metadata: {},
          amount_paid: 0,
        },
      },
    })

    await handleStripeWebhook('payload', 'sig')

    expect(mockRunHook).not.toHaveBeenCalled()
  })

  it('handles invoice.payment_failed event', async () => {
    mockConstructEvent.mockReturnValue({
      type: 'invoice.payment_failed',
      data: {
        object: {
          metadata: { userId: 'user-1' },
          amount_due: 2000,
        },
      },
    })

    await handleStripeWebhook('payload', 'sig')

    expect(mockRunHook).toHaveBeenCalledWith('onPaymentFailed', {
      userId: 'user-1',
      amount: 20,
      error: 'Payment failed',
    })
  })

  it('handles string customer ID on subscription events', async () => {
    setupSelectChain([{ id: 'sub-1' }])

    mockConstructEvent.mockReturnValue({
      type: 'customer.subscription.deleted',
      data: {
        object: {
          customer: 'cus_string_id',
        },
      },
    })

    await handleStripeWebhook('payload', 'sig')

    expect(mockUpdate).toHaveBeenCalled()
  })

  it('handles customer object on subscription events', async () => {
    setupSelectChain([{ id: 'sub-1' }])

    mockConstructEvent.mockReturnValue({
      type: 'customer.subscription.deleted',
      data: {
        object: {
          customer: { id: 'cus_object_id' },
        },
      },
    })

    await handleStripeWebhook('payload', 'sig')

    expect(mockUpdate).toHaveBeenCalled()
  })

  it('falls back to first paid plan when no planId in metadata', async () => {
    setupSelectChain([{ id: 'sub-1' }])

    mockConstructEvent.mockReturnValue({
      type: 'customer.subscription.created',
      data: {
        object: {
          id: 'sub_stripe_new',
          customer: 'cus_123',
          status: 'active',
          current_period_start: 1704067200,
          current_period_end: 1706745600,
          cancel_at_period_end: false,
          trial_end: null,
          items: {
            data: [{
              price: {
                id: 'price_mystery',
                metadata: {},
                recurring: { interval: 'month' },
              },
            }],
          },
        },
      },
    })

    await handleStripeWebhook('payload', 'sig')

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ plan: 'pro' })
    )
  })

  it('handles subscription with trial end date', async () => {
    setupSelectChain([{ id: 'sub-1' }])

    const trialEndTimestamp = 1707350400 // some future timestamp

    mockConstructEvent.mockReturnValue({
      type: 'customer.subscription.created',
      data: {
        object: {
          id: 'sub_trial',
          customer: 'cus_123',
          status: 'trialing',
          current_period_start: 1704067200,
          current_period_end: 1706745600,
          cancel_at_period_end: false,
          trial_end: trialEndTimestamp,
          items: {
            data: [{
              price: {
                id: 'price_pro_m',
                metadata: { planId: 'pro' },
                recurring: { interval: 'month' },
              },
            }],
          },
        },
      },
    })

    await handleStripeWebhook('payload', 'sig')

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        trialEnd: new Date(trialEndTimestamp * 1000),
      })
    )
  })
})
