import { withErrorHandler } from '@/lib/routeHandler'
import { successResponse, errorResponse } from '@unblocks/core/api'
import { tryRequireBlock } from '@unblocks/core/runtime/blockRegistry'

export const GET = withErrorHandler(
  async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const mp = tryRequireBlock<{ getListing: (...args: unknown[]) => Promise<unknown> }>('marketplace')
    if (!mp) {
      return errorResponse('BLOCK_NOT_AVAILABLE', 'Marketplace block is not installed', 404)
    }

    const { id } = await params
    const listing = await mp.getListing(id)

    return successResponse(listing)
  }
)
