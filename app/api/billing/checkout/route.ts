import { z } from 'zod'
import { createCheckoutSession } from '@unblocks/core/billing'
import { validateBody, successResponse } from '@unblocks/core/api'
import { withErrorHandler } from '@/lib/routeHandler'
import { requireAuth } from '@/lib/serverAuth'

const checkoutSchema = z.object({
  planId: z.string().min(1),
  interval: z.enum(['monthly', 'yearly']).default('monthly'),
})

export const POST = withErrorHandler(async (request) => {
  const user = await requireAuth()
  const { planId, interval } = await validateBody(request, checkoutSchema)

  const { url } = await createCheckoutSession(user.id, planId, interval)

  return successResponse({ url })
})
