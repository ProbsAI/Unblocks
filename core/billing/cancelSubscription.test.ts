import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSelect = vi.fn()
const mockFrom = vi.fn()
const mockWhere = vi.fn()
const mockLimit = vi.fn()
const mockUpdate = vi.fn()
const mockSet = vi.fn()
const mockUpdateWhere = vi.fn()

const mockStripeSubCancel = vi.fn()
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
      cancel: mockStripeSubCancel,
      update: mockStripeSubUpdate,
    },
  })),
}))

import { cancelSubscription } from './cancelSubscription'
import { AppError } from '../errors/types'

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

describe('cancelSubscription', () => {
  it('cancels immediately when immediate=true', async () => {
    setupSelectChain([{
      id: 'sub-1',
      stripeSubscriptionId: 'sub_stripe_123',
    }])
    mockStripeSubCancel.mockResolvedValue({})

    await cancelSubscription('user-1', true)

    expect(mockStripeSubCancel).toHaveBeenCalledWith('sub_stripe_123')
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'canceled',
        plan: 'free',
      })
    )
  })

  it('cancels at period end when immediate=false', async () => {
    setupSelectChain([{
      id: 'sub-1',
      stripeSubscriptionId: 'sub_stripe_123',
    }])
    mockStripeSubUpdate.mockResolvedValue({})

    await cancelSubscription('user-1', false)

    expect(mockStripeSubUpdate).toHaveBeenCalledWith('sub_stripe_123', {
      cancel_at_period_end: true,
    })
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        cancelAtPeriodEnd: true,
      })
    )
  })

  it('defaults to cancel at period end', async () => {
    setupSelectChain([{
      id: 'sub-1',
      stripeSubscriptionId: 'sub_stripe_123',
    }])
    mockStripeSubUpdate.mockResolvedValue({})

    await cancelSubscription('user-1')

    expect(mockStripeSubUpdate).toHaveBeenCalledWith('sub_stripe_123', {
      cancel_at_period_end: true,
    })
    expect(mockStripeSubCancel).not.toHaveBeenCalled()
  })

  it('throws AppError when no subscription exists', async () => {
    setupSelectChain([])

    await expect(cancelSubscription('user-1')).rejects.toThrow(AppError)
    await expect(cancelSubscription('user-1')).rejects.toThrow(
      'No active subscription found'
    )
  })

  it('throws AppError when no Stripe subscription ID', async () => {
    setupSelectChain([{
      id: 'sub-1',
      stripeSubscriptionId: null,
    }])

    await expect(cancelSubscription('user-1')).rejects.toThrow(AppError)
  })
})
