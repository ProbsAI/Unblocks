import { withErrorHandler } from '@/lib/routeHandler'
import { requireAuth } from '@/lib/serverAuth'
import { successResponse } from '@unblocks/core/api'
import { getJob } from '@unblocks/core/jobs'

export const GET = withErrorHandler(async (request: Request) => {
  await requireAuth()

  const url = new URL(request.url)
  const jobId = url.searchParams.get('id')

  if (!jobId) {
    return successResponse({ message: 'Job queue is active' })
  }

  const job = await getJob(jobId)

  if (!job) {
    return new Response(
      JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Job not found' } }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    )
  }

  return successResponse(job)
})
