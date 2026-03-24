import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSelect = vi.fn()
const mockFrom = vi.fn()
const mockWhere = vi.fn()
const mockLimit = vi.fn()

vi.mock('../db/client', () => ({
  getDb: vi.fn(() => ({
    select: mockSelect,
  })),
}))

vi.mock('../db/schema/subscriptions', () => ({
  subscriptions: {
    userId: 'userId',
  },
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ a, b })),
}))

import { getSubscription } from './getSubscription'

const mockSub = {
  id: 'sub-1',
  userId: 'user-1',
  stripeCustomerId: 'cus_123',
  stripeSubscriptionId: 'sub_stripe_123',
  stripePriceId: 'price_123',
  plan: 'pro',
  status: 'active',
  interval: 'monthly',
  currentPeriodStart: new Date('2024-01-01'),
  currentPeriodEnd: new Date('2024-02-01'),
  cancelAtPeriodEnd: false,
  trialEnd: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
}

function setupSelectChain(result: unknown[]) {
  mockLimit.mockResolvedValue(result)
  mockWhere.mockReturnValue({ limit: mockLimit })
  mockFrom.mockReturnValue({ where: mockWhere })
  mockSelect.mockReturnValue({ from: mockFrom })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getSubscription', () => {
  it('returns subscription when found', async () => {
    setupSelectChain([mockSub])

    const result = await getSubscription('user-1')

    expect(result).not.toBeNull()
    expect(result!.id).toBe('sub-1')
    expect(result!.plan).toBe('pro')
    expect(result!.status).toBe('active')
  })

  it('returns null when no subscription found', async () => {
    setupSelectChain([])

    const result = await getSubscription('unknown-user')

    expect(result).toBeNull()
  })

  it('maps all subscription fields', async () => {
    setupSelectChain([mockSub])

    const result = await getSubscription('user-1')

    expect(result).toEqual({
      id: 'sub-1',
      userId: 'user-1',
      stripeCustomerId: 'cus_123',
      stripeSubscriptionId: 'sub_stripe_123',
      stripePriceId: 'price_123',
      plan: 'pro',
      status: 'active',
      interval: 'monthly',
      currentPeriodStart: new Date('2024-01-01'),
      currentPeriodEnd: new Date('2024-02-01'),
      cancelAtPeriodEnd: false,
      trialEnd: null,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    })
  })
})
