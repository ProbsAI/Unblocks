import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSelect = vi.fn()
const mockFrom = vi.fn()
const mockWhere = vi.fn()
const mockLimit = vi.fn()
const mockUpdate = vi.fn()
const mockSet = vi.fn()
const mockUpdateWhere = vi.fn()

const mockStripeSubRetrieve = vi.fn()
const mockStripeSubUpdate = vi.fn()

vi.mock('../db/client', () => ({
  getDb: vi.fn(() => ({
    select: mockSelect,
    update: mockUpdate,
  })),
}))

vi.mock('../db/schema/subscriptions', () => ({
  subscriptions: {
    id: 'id',
    userId: 'userId',
  },
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ a, b })),
}))

vi.mock('./customer', () => ({
  getStripe: vi.fn(() => ({
    subscriptions: {
      retrieve: mockStripeSubRetrieve,
      update: mockStripeSubUpdate,
    },
  })),
}))

vi.mock('./plans', () => ({
  getPlanById: vi.fn().mockReturnValue({
    id: 'enterprise',
    name: 'Enterprise',
    price: { monthly: 50, yearly: 500 },
    stripePriceId: { monthly: 'price_ent_m', yearly: 'price_ent_y' },
    limits: {},
    features: [],
  }),
}))

vi.mock('../runtime/hookRunner', () => ({
  runHook: vi.fn().mockResolvedValue(undefined),
}))

import { changePlan } from './changePlan'
import { getPlanById } from './plans'
import { runHook } from '../runtime/hookRunner'
import { AppError } from '../errors/types'

const mockGetPlanById = vi.mocked(getPlanById)
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
  setupUpdateChain()
})

describe('changePlan', () => {
  it('changes subscription plan successfully', async () => {
    setupSelectChain([{
      id: 'sub-1',
      plan: 'pro',
      stripeSubscriptionId: 'sub_stripe_123',
    }])
    mockStripeSubRetrieve.mockResolvedValue({
      items: { data: [{ id: 'si_item_1' }] },
    })
    mockStripeSubUpdate.mockResolvedValue({})

    await changePlan('user-1', 'enterprise', 'monthly')

    expect(mockStripeSubUpdate).toHaveBeenCalledWith('sub_stripe_123', {
      items: [{ id: 'si_item_1', price: 'price_ent_m' }],
      proration_behavior: 'create_prorations',
    })
  })

  it('updates DB subscription record', async () => {
    setupSelectChain([{
      id: 'sub-1',
      plan: 'pro',
      stripeSubscriptionId: 'sub_stripe_123',
    }])
    mockStripeSubRetrieve.mockResolvedValue({
      items: { data: [{ id: 'si_1' }] },
    })
    mockStripeSubUpdate.mockResolvedValue({})

    await changePlan('user-1', 'enterprise', 'monthly')

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        plan: 'enterprise',
        stripePriceId: 'price_ent_m',
        interval: 'monthly',
      })
    )
  })

  it('fires onSubscriptionChanged hook', async () => {
    setupSelectChain([{
      id: 'sub-1',
      plan: 'pro',
      stripeSubscriptionId: 'sub_stripe_123',
    }])
    mockStripeSubRetrieve.mockResolvedValue({
      items: { data: [{ id: 'si_1' }] },
    })
    mockStripeSubUpdate.mockResolvedValue({})

    await changePlan('user-1', 'enterprise')

    expect(mockRunHook).toHaveBeenCalledWith('onSubscriptionChanged', expect.objectContaining({
      userId: 'user-1',
      oldPlan: 'pro',
      newPlan: 'enterprise',
    }))
  })

  it('throws AppError when no subscription exists', async () => {
    setupSelectChain([])

    await expect(changePlan('user-1', 'enterprise')).rejects.toThrow(AppError)
    await expect(changePlan('user-1', 'enterprise')).rejects.toThrow(
      'No active subscription found'
    )
  })

  it('throws AppError when no Stripe subscription ID', async () => {
    setupSelectChain([{
      id: 'sub-1',
      plan: 'free',
      stripeSubscriptionId: null,
    }])

    await expect(changePlan('user-1', 'enterprise')).rejects.toThrow(AppError)
  })

  it('throws AppError when no price configured for interval', async () => {
    setupSelectChain([{
      id: 'sub-1',
      plan: 'pro',
      stripeSubscriptionId: 'sub_stripe_123',
    }])
    mockGetPlanById.mockReturnValue({
      id: 'basic',
      name: 'Basic',
      price: { monthly: 10, yearly: 100 },
      stripePriceId: { monthly: null, yearly: null },
      limits: { projects: 5, teamMembers: 2, storageGb: 5, apiRequestsPerDay: 500 },
      features: [],
    })

    await expect(
      changePlan('user-1', 'basic', 'monthly')
    ).rejects.toThrow('No price configured')
  })

  it('defaults to monthly interval', async () => {
    mockGetPlanById.mockReturnValue({
      id: 'enterprise',
      name: 'Enterprise',
      price: { monthly: 50, yearly: 500 },
      stripePriceId: { monthly: 'price_ent_m', yearly: 'price_ent_y' },
      limits: { projects: 999, teamMembers: 100, storageGb: 1000, apiRequestsPerDay: 100000 },
      features: [],
    })
    setupSelectChain([{
      id: 'sub-1',
      plan: 'pro',
      stripeSubscriptionId: 'sub_stripe_123',
    }])
    mockStripeSubRetrieve.mockResolvedValue({
      items: { data: [{ id: 'si_1' }] },
    })
    mockStripeSubUpdate.mockResolvedValue({})

    await changePlan('user-1', 'enterprise')

    expect(mockStripeSubUpdate).toHaveBeenCalledWith('sub_stripe_123', expect.objectContaining({
      items: [{ id: 'si_1', price: 'price_ent_m' }],
    }))
  })
})
