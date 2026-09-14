import { randomBytes } from 'crypto'
import { getDb } from '../db/client'
import { apiKeys } from '../db/schema/apiKeys'
import { blindIndex } from '../security/blindIndex'
import { ValidationError } from '../errors/types'
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

  // Reject what cannot yet be enforced, rather than handing back a key that can
  // never authenticate.
  //
  // serverAuth accepts only wildcard keys because no route checks scopes, and it
  // discards teamId entirely because no route enforces a team boundary. Issuing
  // a narrow or team-scoped key would therefore return a working-looking secret
  // that fails every request, and imply a restriction that does not exist.
  // Remove these guards in the same change that adds per-route enforcement.
  const scopes = input.scopes ?? ['*']
  if (!scopes.includes('*')) {
    throw new ValidationError(
      'Scoped API keys are not supported yet; omit scopes to create a full-access key',
      { scopes: 'Per-route scope enforcement is not implemented' }
    )
  }

  if (input.teamId) {
    throw new ValidationError(
      'Team-scoped API keys are not supported yet',
      { teamId: 'Team membership is not verified and the boundary is not enforced' }
    )
  }

  // Generate a cryptographically secure random key
  const randomPart = randomBytes(32).toString('hex')
  const fullKey = `${API_KEY_PREFIX}${randomPart}`

  // Visible prefix for identification (first 8 chars of random part)
  const prefix = `${API_KEY_PREFIX}${randomPart.slice(0, 8)}`

  // Blind index for lookup. This is the only derivation we persist — the key
  // itself is returned once below and is not recoverable from the database.
  const keyHash = blindIndex(fullKey)

  // Calculate expiration
  const expiresAt = input.expiresInDays
    ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
    : null

  const [row] = await db.insert(apiKeys).values({
    userId,
    teamId: null,
    name: input.name,
    prefix,
    keyHash,
    scopes,
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
