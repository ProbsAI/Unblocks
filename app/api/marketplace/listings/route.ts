import { withErrorHandler } from '@/lib/routeHandler'
import { requireAuth } from '@/lib/serverAuth'
import { validateBody } from '@unblocks/core/api'
import { successResponse, errorResponse } from '@unblocks/core/api'
import { tryRequireBlock } from '@unblocks/core/runtime/blockRegistry'
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

  const mp = tryRequireBlock<{ createListing: Function }>('marketplace')
  if (!mp) {
    return errorResponse('BLOCK_NOT_AVAILABLE', 'Marketplace block is not installed', 404)
  }

  const listing = await mp.createListing(user.id, body)
  return successResponse(listing, undefined, 201)
})

export const GET = withErrorHandler(async (request: Request) => {
  const mp = tryRequireBlock<{ searchListings: Function }>('marketplace')
  if (!mp) {
    return errorResponse('BLOCK_NOT_AVAILABLE', 'Marketplace block is not installed', 404)
  }

  const url = new URL(request.url)
  const result = await mp.searchListings({
    query: url.searchParams.get('q') ?? undefined,
    category: url.searchParams.get('category') ?? undefined,
    limit: parseInt(url.searchParams.get('limit') ?? '20', 10),
    offset: parseInt(url.searchParams.get('offset') ?? '0', 10),
  })

  return successResponse(result)
})
