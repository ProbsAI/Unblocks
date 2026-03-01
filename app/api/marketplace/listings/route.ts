import { withErrorHandler } from '@/lib/routeHandler'
import { requireAuth } from '@/lib/serverAuth'
import { validateBody } from '@unblocks/core/api'
import { successResponse } from '@unblocks/core/api'
import { createListing, searchListings } from '@/blocks/marketplace'
import { z } from 'zod'

const createSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().min(1),
  type: z.enum(['product', 'service', 'digital', 'subscription']).optional(),
  price: z.number().min(0),
  currency: z.string().optional(),
  images: z.array(z.string()).optional(),
  category: z.string(),
  tags: z.array(z.string()).optional(),
})

export const POST = withErrorHandler(async (request: Request) => {
  const user = await requireAuth()
  const body = await validateBody(request, createSchema)

  const listing = await createListing(user.id, body)

  return successResponse(listing, undefined, 201)
})

export const GET = withErrorHandler(async (request: Request) => {
  const url = new URL(request.url)

  const result = await searchListings({
    query: url.searchParams.get('q') ?? undefined,
    category: url.searchParams.get('category') ?? undefined,
    limit: parseInt(url.searchParams.get('limit') ?? '20', 10),
    offset: parseInt(url.searchParams.get('offset') ?? '0', 10),
  })

  return successResponse(result)
})
