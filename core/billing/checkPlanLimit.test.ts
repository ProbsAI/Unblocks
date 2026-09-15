import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Plan } from './types'

// Which subscription row belongs to a user is getSubscription's problem now —
// a user can hold several, and the rule for choosing is covered against a real
// Postgres in getSubscription.integration.test.ts. These cases are about limit
// arithmetic, so the choice is stubbed.
vi.mock('./getSubscription', () => ({
  getSubscription: vi.fn(),
}))

vi.mock('./plans', () => ({
  getPlanById: vi.fn(),
  getFreePlan: vi.fn(),
}))

import { checkPlanLimit } from './checkPlanLimit'
import { getPlanById, getFreePlan } from './plans'
import { getSubscription } from './getSubscription'

const mockGetPlanById = vi.mocked(getPlanById)
const mockGetFreePlan = vi.mocked(getFreePlan)

const freePlan: Plan = {
  id: 'free',
  name: 'Free',
  price: { monthly: 0, yearly: 0 },
  stripePriceId: { monthly: null, yearly: null },
  limits: { projects: 3, teamMembers: 1, storageGb: 1, apiRequestsPerDay: 100, apiKeys: 3 },
  features: ['basic_dashboard'],
}

const proPlan: Plan = {
  id: 'pro',
  name: 'Pro',
  price: { monthly: 20, yearly: 200 },
  stripePriceId: { monthly: 'price_pro_m', yearly: 'price_pro_y' },
  limits: { projects: 50, teamMembers: 10, storageGb: 100, apiRequestsPerDay: 10000, apiKeys: 25 },
  features: ['basic_dashboard', 'priority_support'],
}

function setupDbChain(result: Array<{ plan: string; status?: string }>) {
  const row = result[0]
  vi.mocked(getSubscription).mockResolvedValue(
    row ? ({ status: 'active', ...row } as never) : null
  )
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
