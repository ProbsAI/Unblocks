import { eq, and, isNull } from 'drizzle-orm'
import { getDb } from '../db/client'
import { apiKeys } from '../db/schema/apiKeys'
import { blindIndex } from '../security/blindIndex'
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
const API_KEY_FORMAT = new RegExp(`^${API_KEY_PREFIX}[0-9a-f]{64}$`)

export async function validateApiKey(key: string): Promise<ApiKeyValidation> {
  // Match the full generated shape, not just the prefix. blindIndex runs a
  // PBKDF2 derivation, so accepting anything that merely starts with the prefix
  // lets an unauthenticated caller spend that CPU at will, with a payload of
  // any length. createApiKey emits exactly the prefix plus 32 random bytes in
  // hex; nothing else can ever match a stored row, so rejecting early costs
  // nothing.
  if (!API_KEY_FORMAT.test(key)) return INVALID

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
 * Does this string look like it was MEANT to be an Unblocks API key?
 *
 * Deliberately looser than the format validateApiKey enforces, and the two
 * should not be merged. This answers a routing question — "should this
 * credential go down the API-key path?" — and a mistyped or truncated key
 * should still go there, so the caller gets an invalid-key error rather than
 * being silently treated as an unauthenticated session.
 *
 * It grants nothing. Authentication is validateApiKey's job, and that requires
 * the exact generated shape before it will even derive an index.
 */
export function isApiKey(value: string): boolean {
  return value.startsWith(API_KEY_PREFIX)
}
