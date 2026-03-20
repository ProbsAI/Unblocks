import { createHmac } from 'crypto'

/**
 * Returns the HMAC key used for blind index generation.
 * Uses a separate key derived from ENCRYPTION_KEY to maintain
 * key separation between encryption and indexing.
 */
function getHmacKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY
  if (!raw) {
    throw new Error('ENCRYPTION_KEY is required for blind index generation')
  }

  // Use the primary key (first in the comma-separated list)
  const primaryKey = raw.split(',')[0].trim()

  // Derive a separate key for HMAC using a domain separator.
  // This ensures the blind index key is different from the encryption key.
  return createHmac('sha256', 'unblocks-blind-index-key')
    .update(primaryKey)
    .digest()
}

/**
 * Generates a deterministic blind index (HMAC-SHA256) for a plaintext value.
 *
 * Use this for WHERE clause lookups on encrypted fields:
 *   - Store: email_hash = blindIndex(email), email_encrypted = encrypt(email)
 *   - Query: WHERE email_hash = blindIndex(inputEmail)
 *
 * The index is deterministic (same input = same output) so it can be
 * used for equality lookups, but it cannot be reversed to recover
 * the original value.
 */
export function blindIndex(value: string): string {
  const key = getHmacKey()
  return createHmac('sha256', key).update(value.toLowerCase()).digest('hex')
}

/**
 * Generates a blind index, returning null if input is null/undefined.
 * Convenience wrapper for nullable database columns.
 */
export function blindIndexNullable(
  value: string | null | undefined
): string | null {
  if (value == null) return null
  return blindIndex(value)
}
