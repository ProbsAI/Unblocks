import { eq, and, isNull, desc } from 'drizzle-orm'
import { getDb } from '../db/client'
import { apiKeys } from '../db/schema/apiKeys'
import type { ApiKey } from './types'

/**
 * List API keys for a user.
 *
 * Returns metadata only — never the full key or encrypted key.
 * Excludes revoked keys by default.
 */
export async function listApiKeys(
  userId: string,
  includeRevoked = false
): Promise<ApiKey[]> {
  const db = getDb()

  // Filter in SQL. This previously built an array of conditions, applied only
  // the first, then dropped revoked rows in JavaScript — transferring rows only
  // to discard them, and leaving the real predicate unexpressed in the query.
  const where = includeRevoked
    ? eq(apiKeys.userId, userId)
    : and(eq(apiKeys.userId, userId), isNull(apiKeys.revokedAt))

  const rows = await db
    .select({
      id: apiKeys.id,
      userId: apiKeys.userId,
      teamId: apiKeys.teamId,
      name: apiKeys.name,
      prefix: apiKeys.prefix,
      scopes: apiKeys.scopes,
      lastUsedAt: apiKeys.lastUsedAt,
      expiresAt: apiKeys.expiresAt,
      revokedAt: apiKeys.revokedAt,
      createdAt: apiKeys.createdAt,
    })
    .from(apiKeys)
    .where(where)
    .orderBy(desc(apiKeys.createdAt))

  return rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    teamId: row.teamId,
    name: row.name,
    prefix: row.prefix,
    scopes: row.scopes as string[],
    lastUsedAt: row.lastUsedAt,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt,
    createdAt: row.createdAt,
  }))
}
