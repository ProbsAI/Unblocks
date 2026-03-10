import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Plan } from './types'

vi.mock('../runtime/configLoader', () => ({
  loadConfig: vi.fn(),
}))

import { loadConfig } from '../runtime/configLoader'
import { getAllPlans, getPlanById, getFreePlan } from './plans'
import { NotFoundError } from '../errors/types'

const mockLoadConfig = vi.mocked(loadConfig)

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

describe('getAllPlans', () => {
  it('returns all plans from config', () => {
    mockLoadConfig.mockReturnValue({ plans: [freePlan, proPlan, enterprisePlan] })

    const result = getAllPlans()

    expect(result).toEqual([freePlan, proPlan, enterprisePlan])
    expect(result).toHaveLength(3)
    expect(mockLoadConfig).toHaveBeenCalledWith('billing')
  })
})

describe('getPlanById', () => {
  it('returns the correct plan', () => {
    mockLoadConfig.mockReturnValue({ plans: [freePlan, proPlan, enterprisePlan] })

    const result = getPlanById('pro')

    expect(result).toEqual(proPlan)
  })

  it('throws NotFoundError for unknown plan', () => {
    mockLoadConfig.mockReturnValue({ plans: [freePlan, proPlan] })

    expect(() => getPlanById('unknown')).toThrow(NotFoundError)
    expect(() => getPlanById('unknown')).toThrow('Plan "unknown" not found')
  })
})

describe('getFreePlan', () => {
  it('returns plan with monthly price 0', () => {
    mockLoadConfig.mockReturnValue({ plans: [proPlan, freePlan, enterprisePlan] })

    const result = getFreePlan()

    expect(result).toEqual(freePlan)
    expect(result.price.monthly).toBe(0)
  })

  it('falls back to first plan if no free plan exists', () => {
    mockLoadConfig.mockReturnValue({ plans: [proPlan, enterprisePlan] })

    const result = getFreePlan()

    expect(result).toEqual(proPlan)
  })
})
