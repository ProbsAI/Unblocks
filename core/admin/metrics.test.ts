import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Plan } from '../billing/types'

vi.mock('../billing/plans', () => ({
  getAllPlans: vi.fn(),
}))

import { getAllPlans } from '../billing/plans'
import { getAveragePaidPlanPrice } from './metrics'

const mockGetAllPlans = vi.mocked(getAllPlans)

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

const enterprisePlan: Plan = {
  id: 'enterprise',
  name: 'Enterprise',
  price: { monthly: 100, yearly: 1000 },
  stripePriceId: { monthly: 'price_ent_m', yearly: 'price_ent_y' },
  limits: { projects: 999, teamMembers: 100, storageGb: 1000, apiRequestsPerDay: 100000 },
  features: ['basic_dashboard', 'priority_support', 'sla'],
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getAveragePaidPlanPrice', () => {
  it('returns average of paid plan prices', () => {
    mockGetAllPlans.mockReturnValue([freePlan, proPlan, enterprisePlan])

    const result = getAveragePaidPlanPrice()

    // (20 + 100) / 2 = 60
    expect(result).toBe(60)
  })

  it('returns 0 when no paid plans exist', () => {
    mockGetAllPlans.mockReturnValue([freePlan])

    const result = getAveragePaidPlanPrice()

    expect(result).toBe(0)
  })

  it('excludes free plans from average', () => {
    mockGetAllPlans.mockReturnValue([freePlan, proPlan])

    const result = getAveragePaidPlanPrice()

    // Only proPlan (20) is paid, so average = 20
    expect(result).toBe(20)
  })
})
