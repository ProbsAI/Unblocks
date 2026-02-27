import { withErrorHandler } from '@/lib/routeHandler'
import { successResponse } from '@unblocks/core/api'
import { getListing } from '@/blocks/marketplace'

export const GET = withErrorHandler(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params

    const listing = await getListing(id)

    return successResponse(listing)
  }
)
