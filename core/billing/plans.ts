import { loadConfig } from '../runtime/configLoader'
import type { Plan } from './types'
import { NotFoundError } from '../errors/types'

export function getAllPlans(): Plan[] {
  const config = loadConfig('billing')
  return config.plans
}

export function getPlanById(planId: string): Plan {
  const plans = getAllPlans()
  const plan = plans.find((p) => p.id === planId)

  if (!plan) {
    throw new NotFoundError(`Plan "${planId}"`)
  }

  return plan
}

export function getFreePlan(): Plan {
  const plans = getAllPlans()
  return plans.find((p) => p.price.monthly === 0) ?? plans[0]
}
