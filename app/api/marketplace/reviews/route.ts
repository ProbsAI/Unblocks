import { withErrorHandler } from '@/lib/routeHandler'
import { requireAuth } from '@/lib/serverAuth'
import { validateBody } from '@unblocks/core/api'
import { successResponse, errorResponse } from '@unblocks/core/api'
import { tryRequireBlock } from '@unblocks/core/runtime/blockRegistry'
import { z } from 'zod'

const createSchema = z.object({
  orderId: z.string().uuid(),
  rating: z.number().min(1).max(5),
  title: z.string().min(1).max(255),
  body: z.string().optional(),
})

export const POST = withErrorHandler(async (request: Request) => {
  const user = await requireAuth()
  const body = await validateBody(request, createSchema)

  const mp = tryRequireBlock<{ createReview: Function }>('marketplace')
  if (!mp) {
    return errorResponse('BLOCK_NOT_AVAILABLE', 'Marketplace block is not installed', 404)
  }

  const review = await mp.createReview(user.id, body)
  return successResponse(review, undefined, 201)
})

export const GET = withErrorHandler(async (request: Request) => {
  const mp = tryRequireBlock<{ getListingReviews: Function }>('marketplace')
  if (!mp) {
    return errorResponse('BLOCK_NOT_AVAILABLE', 'Marketplace block is not installed', 404)
  }

  const url = new URL(request.url)
  const listingId = url.searchParams.get('listingId')

  if (!listingId) {
    return errorResponse('VALIDATION_ERROR', 'listingId is required', 400)
  }

  const listingReviews = await mp.getListingReviews(listingId)
  return successResponse(listingReviews)
})
