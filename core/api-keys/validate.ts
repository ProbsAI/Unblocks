import { eq, and, isNull } from 'drizzle-orm'
import { getDb } from '../db/client'
import { apiKeys } from '../db/schema/apiKeys'
import { blindIndex } from '../security/blindIndex'
import type { ApiKey } from './types'
import { API_KEY_PREFIX } from './types'

export interface ApiKeyValidation {
  valid: boolean
  userId: string | null
  teamId: string | null
  scopes: string[]
  apiKeyId: string | null
}

const INVALID: ApiKeyValidation = {
  valid: false,
  userId: null,
  teamId: null,
  scopes: [],
  apiKeyId: null,
}

/**
 * Validate an API key and return the associated user/team info.
 *
 * Checks: key format, existence, not revoked, not expired.
 * Updates lastUsedAt on successful validation.
 */
export async function validateApiKey(key: string): Promise<ApiKeyValidation> {
  if (!key.startsWith(API_KEY_PREFIX)) return INVALID

  const db = getDb()
  const keyHash = blindIndex(key)

  const [row] = await db
    .select()
    .from(apiKeys)
    .where(
      and(
        eq(apiKeys.keyHash, keyHash),
        isNull(apiKeys.revokedAt)
      )
    )
    .limit(1)

  if (!row) return INVALID

  // Check expiration
  if (row.expiresAt && row.expiresAt < new Date()) return INVALID

  // Update lastUsedAt (fire-and-forget, don't block the request)
  db.update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, row.id))
    .then(() => {}, () => {})

  return {
    valid: true,
    userId: row.userId,
    teamId: row.teamId,
    scopes: row.scopes as string[],
    apiKeyId: row.id,
  }
}

/**
 * Check if a key string looks like an Unblocks API key.
 */
export function isApiKey(value: string): boolean {
  return value.startsWith(API_KEY_PREFIX)
}
