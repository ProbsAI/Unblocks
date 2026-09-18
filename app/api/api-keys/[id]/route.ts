import { withErrorHandler } from '@/lib/routeHandler'
import { requireAuth } from '@/lib/serverAuth'
import { successResponse } from '@unblocks/core/api'
import { revokeApiKey } from '@unblocks/core/api-keys'
import { ValidationError } from '@unblocks/core/errors/types'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const DELETE = withErrorHandler(async (_request: Request, context) => {
  const user = await requireAuth()
  const { id } = await context!.params

  // Next types a dynamic segment as string | string[]; this route only ever
  // takes a single id. Validate the UUID shape too: an arbitrary string reaches
  // a uuid column and fails during the Postgres cast, turning a client error
  // into a 500.
  if (typeof id !== 'string' || !UUID_PATTERN.test(id)) {
    throw new ValidationError('Invalid API key id', {
      id: 'Expected a single API key id in UUID form',
    })
  }

  await revokeApiKey(id, user.id)

  return successResponse({ revoked: true })
})
