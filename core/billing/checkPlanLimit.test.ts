import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Plan } from './types'

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
    plan: 'plan',
  },
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ a, b })),
}))

vi.mock('./plans', () => ({
  getPlanById: vi.fn(),
  getFreePlan: vi.fn(),
}))

import { checkPlanLimit } from './checkPlanLimit'
import { getPlanById, getFreePlan } from './plans'

const mockGetPlanById = vi.mocked(getPlanById)
const mockGetFreePlan = vi.mocked(getFreePlan)

const freePlan: Plan = {
  id: 'free',
  name: 'Free',
  price: { monthly: 0, yearly: 0 },
  stripePriceId: { monthly: null, yearly: null },
  limits: { projects: 3, teamMembers: 1, storageGb: 1, apiRequestsPerDay: 100 },
  features: ['basic_dashboard'],
}

const proPlan: Plan = {
  id: 'pro',
  name: 'Pro',
  price: { monthly: 20, yearly: 200 },
  stripePriceId: { monthly: 'price_pro_m', yearly: 'price_pro_y' },
  limits: { projects: 50, teamMembers: 10, storageGb: 100, apiRequestsPerDay: 10000 },
  features: ['basic_dashboard', 'priority_support'],
}

function setupDbChain(result: Array<{ plan: string }>) {
  mockLimit.mockResolvedValue(result)
  mockWhere.mockReturnValue({ limit: mockLimit })
  mockFrom.mockReturnValue({ where: mockWhere })
  mockSelect.mockReturnValue({ from: mockFrom })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('checkPlanLimit', () => {
  it('returns allowed=true when under limit', async () => {
    setupDbChain([{ plan: 'pro' }])
    mockGetPlanById.mockReturnValue(proPlan)

    const result = await checkPlanLimit('user-1', 'projects', 10)

    expect(result).toEqual({ allowed: true, current: 10, limit: 50 })
  })

  it('returns allowed=false when at limit', async () => {
    setupDbChain([{ plan: 'pro' }])
    mockGetPlanById.mockReturnValue(proPlan)

    const result = await checkPlanLimit('user-1', 'projects', 50)

    expect(result).toEqual({ allowed: false, current: 50, limit: 50 })
  })

  it('returns allowed=false when over limit', async () => {
    setupDbChain([{ plan: 'pro' }])
    mockGetPlanById.mockReturnValue(proPlan)

    const result = await checkPlanLimit('user-1', 'projects', 100)

    expect(result).toEqual({ allowed: false, current: 100, limit: 50 })
  })

  it('falls back to free plan when no subscription found', async () => {
    setupDbChain([])
    mockGetPlanById.mockReturnValue(freePlan)

    const result = await checkPlanLimit('user-1', 'projects', 2)

    expect(mockGetPlanById).toHaveBeenCalledWith('free')
    expect(result).toEqual({ allowed: true, current: 2, limit: 3 })
  })

  it('falls back to free plan when plan not found', async () => {
    setupDbChain([{ plan: 'deleted-plan' }])
    mockGetPlanById.mockImplementation(() => {
      throw new Error('not found')
    })
    mockGetFreePlan.mockReturnValue(freePlan)

    const result = await checkPlanLimit('user-1', 'projects', 2)

    expect(mockGetFreePlan).toHaveBeenCalled()
    expect(result).toEqual({ allowed: true, current: 2, limit: 3 })
  })

  it('returns allowed=true with Infinity for undefined limit keys', async () => {
    setupDbChain([{ plan: 'pro' }])
    mockGetPlanById.mockReturnValue(proPlan)

    const result = await checkPlanLimit('user-1', 'nonExistentLimit', 999)

    expect(result).toEqual({ allowed: true, current: 999, limit: Infinity })
  })

  it('uses correct plan from subscription', async () => {
    setupDbChain([{ plan: 'pro' }])
    mockGetPlanById.mockReturnValue(proPlan)

    await checkPlanLimit('user-1', 'teamMembers', 5)

    expect(mockGetPlanById).toHaveBeenCalledWith('pro')
  })
})
