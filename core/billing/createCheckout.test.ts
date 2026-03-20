import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCheckoutCreate = vi.fn()

vi.mock('./customer', () => ({
  getStripe: vi.fn(() => ({
    checkout: {
      sessions: {
        create: mockCheckoutCreate,
      },
    },
  })),
  getOrCreateCustomer: vi.fn().mockResolvedValue('cus_123'),
}))

vi.mock('./plans', () => ({
  getPlanById: vi.fn().mockReturnValue({
    id: 'pro',
    name: 'Pro',
    price: { monthly: 20, yearly: 200 },
    stripePriceId: { monthly: 'price_pro_monthly', yearly: 'price_pro_yearly' },
    limits: {},
    features: [],
  }),
}))

import { createCheckoutSession } from './createCheckout'
import { getPlanById } from './plans'

const mockGetPlanById = vi.mocked(getPlanById)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('createCheckoutSession', () => {
  it('creates checkout session with monthly price', async () => {
    mockCheckoutCreate.mockResolvedValue({
      url: 'https://checkout.stripe.com/session-123',
    })

    const result = await createCheckoutSession('user-1', 'pro', 'monthly')

    expect(result.url).toBe('https://checkout.stripe.com/session-123')
    expect(mockCheckoutCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: 'cus_123',
        mode: 'subscription',
        line_items: [{ price: 'price_pro_monthly', quantity: 1 }],
        metadata: { userId: 'user-1', planId: 'pro' },
      })
    )
  })

  it('creates checkout session with yearly price', async () => {
    mockCheckoutCreate.mockResolvedValue({
      url: 'https://checkout.stripe.com/session-yearly',
    })

    const result = await createCheckoutSession('user-1', 'pro', 'yearly')

    expect(result.url).toBe('https://checkout.stripe.com/session-yearly')
    expect(mockCheckoutCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [{ price: 'price_pro_yearly', quantity: 1 }],
      })
    )
  })

  it('defaults to monthly interval', async () => {
    mockCheckoutCreate.mockResolvedValue({
      url: 'https://checkout.stripe.com/session-default',
    })

    await createCheckoutSession('user-1', 'pro')

    expect(mockCheckoutCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [{ price: 'price_pro_monthly', quantity: 1 }],
      })
    )
  })

  it('throws when no Stripe price configured for interval', async () => {
    mockGetPlanById.mockReturnValue({
      id: 'basic',
      name: 'Basic',
      price: { monthly: 10, yearly: 100 },
      stripePriceId: { monthly: null, yearly: null },
      limits: { projects: 5, teamMembers: 2, storageGb: 5, apiRequestsPerDay: 500 },
      features: [],
    })

    await expect(
      createCheckoutSession('user-1', 'basic', 'monthly')
    ).rejects.toThrow('No Stripe price configured')
  })

  it('throws when checkout session has no URL', async () => {
    mockCheckoutCreate.mockResolvedValue({ url: null })

    await expect(
      createCheckoutSession('user-1', 'pro', 'monthly')
    ).rejects.toThrow('Failed to create checkout session')
  })

  it('includes success and cancel URLs', async () => {
    mockCheckoutCreate.mockResolvedValue({
      url: 'https://checkout.stripe.com/session',
    })

    await createCheckoutSession('user-1', 'pro')

    expect(mockCheckoutCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        success_url: expect.stringContaining('/dashboard/billing?success=true'),
        cancel_url: expect.stringContaining('/dashboard/billing?canceled=true'),
      })
    )
  })
})
