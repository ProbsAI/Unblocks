import { randomBytes } from 'crypto'
import { getDb } from '../db/client'
import { apiKeys } from '../db/schema/apiKeys'
import { encrypt } from '../security/encryption'
import { blindIndex } from '../security/blindIndex'
import type { CreateApiKeyInput, CreateApiKeyResult, ApiKey } from './types'
import { API_KEY_PREFIX } from './types'

/**
 * Create a new API key for a user.
 *
 * Returns the full key ONCE — it cannot be retrieved again.
 * Only the prefix is stored in plaintext for identification.
 */
export async function createApiKey(
  userId: string,
  input: CreateApiKeyInput
): Promise<CreateApiKeyResult> {
  const db = getDb()

  // Generate a cryptographically secure random key
  const randomPart = randomBytes(32).toString('hex')
  const fullKey = `${API_KEY_PREFIX}${randomPart}`

  // Visible prefix for identification (first 8 chars of random part)
  const prefix = `${API_KEY_PREFIX}${randomPart.slice(0, 8)}`

  // Hash for lookup (blind index)
  const keyHash = blindIndex(fullKey)

  // Encrypt for storage
  const keyEncrypted = encrypt(fullKey)

  // Calculate expiration
  const expiresAt = input.expiresInDays
    ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
    : null

  const [row] = await db.insert(apiKeys).values({
    userId,
    teamId: input.teamId ?? null,
    name: input.name,
    prefix,
    keyHash,
    keyEncrypted,
    scopes: input.scopes ?? ['*'],
    expiresAt,
  }).returning()

  const apiKey: ApiKey = {
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
  }

  return { key: fullKey, apiKey }
}
