import { getSubscription, getAllPlans } from '@unblocks/core/billing'
import { successResponse } from '@unblocks/core/api'
import { withErrorHandler } from '@/lib/routeHandler'
import { requireAuth } from '@/lib/serverAuth'

export const GET = withErrorHandler(async () => {
  const user = await requireAuth()
  const subscription = await getSubscription(user.id)
  const plans = getAllPlans()

  return successResponse({ subscription, plans })
})
