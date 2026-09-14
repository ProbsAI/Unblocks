import { withErrorHandler } from '@/lib/routeHandler'
import { requireAuth } from '@/lib/serverAuth'
import { successResponse } from '@unblocks/core/api'
import { revokeApiKey } from '@unblocks/core/api-keys'
import { ValidationError } from '@unblocks/core/errors/types'

export const DELETE = withErrorHandler(async (_request: Request, context) => {
  const user = await requireAuth()
  const { id } = await context!.params

  // Next types a dynamic segment as string | string[]; this route only ever
  // takes a single id.
  if (typeof id !== 'string') {
    throw new ValidationError('Invalid API key id', {
      id: 'Expected a single API key id',
    })
  }

  await revokeApiKey(id, user.id)

  return successResponse({ revoked: true })
})
