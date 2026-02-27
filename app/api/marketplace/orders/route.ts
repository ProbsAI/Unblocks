import { withErrorHandler } from '@/lib/routeHandler'
import { requireAuth } from '@/lib/serverAuth'
import { validateBody } from '@unblocks/core/api'
import { successResponse } from '@unblocks/core/api'
import { createOrder, getUserOrders } from '@/blocks/marketplace'
import { z } from 'zod'

const createSchema = z.object({
  listingId: z.string().uuid(),
  quantity: z.number().min(1).default(1),
})

export const POST = withErrorHandler(async (request: Request) => {
  const user = await requireAuth()
  const body = await validateBody(request, createSchema)

  const order = await createOrder(user.id, body.listingId, body.quantity)

  return successResponse(order, undefined, 201)
})

export const GET = withErrorHandler(async (request: Request) => {
  const user = await requireAuth()
  const url = new URL(request.url)
  const role = (url.searchParams.get('role') ?? 'both') as 'buyer' | 'seller' | 'both'

  const userOrders = await getUserOrders(user.id, role)

  return successResponse(userOrders)
})
