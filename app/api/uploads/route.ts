import { withErrorHandler } from '@/lib/routeHandler'
import { requireAuth } from '@/lib/serverAuth'
import { successResponse } from '@unblocks/core/api'
import { uploadFile, listFiles } from '@unblocks/core/uploads'

export const POST = withErrorHandler(async (request: Request) => {
  const user = await requireAuth()
  const formData = await request.formData()
  const file = formData.get('file')

  if (!file || !(file instanceof File)) {
    return new Response(
      JSON.stringify({ error: { code: 'VALIDATION_ERROR', message: 'No file provided' } }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const rawTeamId = formData.get('teamId')
  const teamId = typeof rawTeamId === 'string' ? rawTeamId : undefined

  const result = await uploadFile(
    user.id,
    buffer,
    file.name,
    file.type,
    teamId
  )

  return successResponse(result, undefined, 201)
})

export const GET = withErrorHandler(async (request: Request) => {
  const user = await requireAuth()
  const url = new URL(request.url)
  const teamId = url.searchParams.get('teamId') ?? undefined

  const userFiles = await listFiles(user.id, teamId)

  return successResponse(userFiles)
})
