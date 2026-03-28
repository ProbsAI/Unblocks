import { eq, isNull, desc } from 'drizzle-orm'
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

  const conditions = includeRevoked
    ? eq(apiKeys.userId, userId)
    : [eq(apiKeys.userId, userId), isNull(apiKeys.revokedAt)]

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
    .where(Array.isArray(conditions) ? conditions[0] : conditions)
    .orderBy(desc(apiKeys.createdAt))

  // Apply second condition if filtering revoked
  const filtered = !includeRevoked
    ? rows.filter((r) => r.revokedAt === null)
    : rows

  return filtered.map((row) => ({
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
