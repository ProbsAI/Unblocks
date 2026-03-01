import { withErrorHandler } from '@/lib/routeHandler'
import { requireAuth } from '@/lib/serverAuth'
import { validateBody } from '@unblocks/core/api'
import { successResponse } from '@unblocks/core/api'
import { createReview, getListingReviews } from '@/blocks/marketplace'
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

  const review = await createReview(user.id, body)

  return successResponse(review, undefined, 201)
})

export const GET = withErrorHandler(async (request: Request) => {
  const url = new URL(request.url)
  const listingId = url.searchParams.get('listingId')

  if (!listingId) {
    return new Response(
      JSON.stringify({ error: { code: 'BAD_REQUEST', message: 'listingId is required' } }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const listingReviews = await getListingReviews(listingId)

  return successResponse(listingReviews)
})
