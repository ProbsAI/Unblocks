import { eq, and } from 'drizzle-orm'
import { getDb } from '../db/client'
import { apiKeys } from '../db/schema/apiKeys'
import { NotFoundError, ForbiddenError } from '../errors/types'

/**
 * Revoke an API key by setting revokedAt.
 *
 * Only the key owner can revoke it.
 */
export async function revokeApiKey(
  keyId: string,
  userId: string
): Promise<void> {
  const db = getDb()

  const [row] = await db
    .select({ id: apiKeys.id, userId: apiKeys.userId })
    .from(apiKeys)
    .where(eq(apiKeys.id, keyId))
    .limit(1)

  if (!row) {
    throw new NotFoundError('API key not found')
  }

  if (row.userId !== userId) {
    throw new ForbiddenError('Cannot revoke another user\'s API key')
  }

  await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(eq(apiKeys.id, keyId))
}
