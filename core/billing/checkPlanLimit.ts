import { eq } from 'drizzle-orm'
import { getDb } from '../db/client'
import { subscriptions } from '../db/schema/subscriptions'
import { getPlanById, getFreePlan } from './plans'
import { getSubscription } from './getSubscription'

interface PlanLimitResult {
  allowed: boolean
  current: number
  limit: number
}

export async function checkPlanLimit(
  userId: string,
  limitKey: string,
  currentUsage: number
): Promise<PlanLimitResult> {
  const db = getDb()

  // Same deterministic selection as everywhere else. A user can hold several
  // subscription rows, and a bare LIMIT 1 could hand back a cancelled one —
  // silently applying free-tier limits to a paying customer, or the reverse.
  const sub = await getSubscription(userId)

  const planId = sub?.status === 'canceled' ? 'free' : sub?.plan ?? 'free'
  let plan

  try {
    plan = getPlanById(planId)
  } catch {
    plan = getFreePlan()
  }

  const limits = plan.limits as Record<string, number>
  const limit = limits[limitKey]

  if (limit === undefined) {
    // No limit defined for this key — allow
    return { allowed: true, current: currentUsage, limit: Infinity }
  }

  return {
    allowed: currentUsage < limit,
    current: currentUsage,
    limit,
  }
}
