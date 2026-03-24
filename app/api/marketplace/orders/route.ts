import { withErrorHandler } from '@/lib/routeHandler'
import { requireAuth } from '@/lib/serverAuth'
import { validateBody } from '@unblocks/core/api'
import { successResponse, errorResponse } from '@unblocks/core/api'
import { tryRequireBlock } from '@unblocks/core/runtime/blockRegistry'
import { z } from 'zod'

const createSchema = z.object({
  listingId: z.string().uuid(),
  quantity: z.number().min(1).default(1),
})

export const POST = withErrorHandler(async (request: Request) => {
  const user = await requireAuth()
  const body = await validateBody(request, createSchema)

  const mp = tryRequireBlock<{ createOrder: (...args: unknown[]) => Promise<unknown> }>('marketplace')
  if (!mp) {
    return errorResponse('BLOCK_NOT_AVAILABLE', 'Marketplace block is not installed', 404)
  }

  const order = await mp.createOrder(user.id, body.listingId, body.quantity)
  return successResponse(order, undefined, 201)
})

export const GET = withErrorHandler(async (request: Request) => {
  const user = await requireAuth()

  const mp = tryRequireBlock<{ getUserOrders: (...args: unknown[]) => Promise<unknown> }>('marketplace')
  if (!mp) {
    return errorResponse('BLOCK_NOT_AVAILABLE', 'Marketplace block is not installed', 404)
  }

  const url = new URL(request.url)
  const role = (url.searchParams.get('role') ?? 'both') as 'buyer' | 'seller' | 'both'
  const userOrders = await mp.getUserOrders(user.id, role)

  return successResponse(userOrders)
})
