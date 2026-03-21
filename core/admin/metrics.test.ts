import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Plan } from '../billing/types'

vi.mock('../billing/plans', () => ({
  getAllPlans: vi.fn(),
}))

vi.mock('../db/client', () => ({
  getDb: vi.fn(),
}))

vi.mock('../db/schema/users', () => ({ users: { lastLoginAt: 'lastLoginAt' } }))
vi.mock('../db/schema/subscriptions', () => ({ subscriptions: { status: 'status', plan: 'plan' } }))
vi.mock('../db/schema/teams', () => ({ teams: {} }))
vi.mock('drizzle-orm', () => ({
  sql: vi.fn(),
  eq: vi.fn((a: unknown, b: unknown) => ({ a, b })),
  gte: vi.fn((a: unknown, b: unknown) => ({ a, b })),
  and: vi.fn((...args: unknown[]) => args),
}))

import { getAllPlans } from '../billing/plans'
import { getAveragePaidPlanPrice, getMetrics } from './metrics'
import { getDb } from '../db/client'

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

describe('getMetrics', () => {
  function setupDbMock(counts: { users: number; active: number; subs: number; paid: number; teams: number }) {
    const mockFrom = vi.fn()
    const _mockWhere = vi.fn()
    const mockSelect = vi.fn()

    let callIndex = 0
    const results = [
      [{ count: counts.users }],
      [{ count: counts.active }],
      [{ count: counts.subs }],
      [{ count: counts.paid }],
      [{ count: counts.teams }],
    ]

    mockFrom.mockImplementation(() => {
      const current = callIndex++
      return {
        where: () => results[current],
        then: (resolve: (v: unknown) => void) => resolve(results[current]),
      }
    })

    mockSelect.mockReturnValue({ from: mockFrom })
    vi.mocked(getDb).mockReturnValue({ select: mockSelect } as unknown as ReturnType<typeof getDb>)
  }

  it('returns all metrics', async () => {
    mockGetAllPlans.mockReturnValue([freePlan, proPlan, enterprisePlan])
    setupDbMock({ users: 100, active: 42, subs: 80, paid: 30, teams: 10 })

    const result = await getMetrics()

    expect(result).toEqual({
      totalUsers: 100,
      activeUsers30d: 42,
      totalSubscriptions: 80,
      paidSubscriptions: 30,
      mrr: 30 * 60, // 30 paid * avg price of (20+100)/2=60
      totalTeams: 10,
    })
  })

  it('returns zero MRR when no paid plans', async () => {
    mockGetAllPlans.mockReturnValue([freePlan])
    setupDbMock({ users: 10, active: 5, subs: 10, paid: 0, teams: 2 })

    const result = await getMetrics()

    expect(result.mrr).toBe(0)
  })
})
