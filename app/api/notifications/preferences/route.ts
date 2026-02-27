import { withErrorHandler } from '@/lib/routeHandler'
import { requireAuth } from '@/lib/serverAuth'
import { validateBody } from '@unblocks/core/api'
import { successResponse } from '@unblocks/core/api'
import { getPreferences, updatePreference } from '@unblocks/core/notifications'
import { z } from 'zod'

export const GET = withErrorHandler(async () => {
  const user = await requireAuth()
  const prefs = await getPreferences(user.id)
  return successResponse(prefs)
})

const updateSchema = z.object({
  category: z.string(),
  inApp: z.boolean().optional(),
  email: z.boolean().optional(),
})

export const PATCH = withErrorHandler(async (request: Request) => {
  const user = await requireAuth()
  const body = await validateBody(request, updateSchema)

  const pref = await updatePreference(user.id, body.category, {
    inApp: body.inApp,
    email: body.email,
  })

  return successResponse(pref)
})
