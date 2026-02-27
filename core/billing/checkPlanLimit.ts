import { eq } from 'drizzle-orm'
import { getDb } from '../db/client'
import { subscriptions } from '../db/schema/subscriptions'
import { getPlanById, getFreePlan } from './plans'

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

  const [sub] = await db
    .select({ plan: subscriptions.plan })
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1)

  const planId = sub?.plan ?? 'free'
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
