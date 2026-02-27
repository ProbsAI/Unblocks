import { createCustomerPortalSession } from '@unblocks/core/billing'
import { successResponse } from '@unblocks/core/api'
import { withErrorHandler } from '@/lib/routeHandler'
import { requireAuth } from '@/lib/serverAuth'

export const POST = withErrorHandler(async () => {
  const user = await requireAuth()
  const { url } = await createCustomerPortalSession(user.id)

  return successResponse({ url })
})
