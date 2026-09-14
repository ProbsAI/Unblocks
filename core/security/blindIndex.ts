import { createHmac } from 'crypto'

/**
 * Returns the HMAC key used for blind index generation.
 *
 * Uses BLIND_INDEX_KEY if set (recommended for key rotation scenarios).
 * Falls back to deriving from the primary ENCRYPTION_KEY with a domain
 * separator to maintain key separation.
 *
 * IMPORTANT: BLIND_INDEX_KEY must remain stable across encryption key
 * rotations. If you rotate ENCRYPTION_KEY without a separate
 * BLIND_INDEX_KEY, all *_hash columns become stale and equality
 * lookups will fail.
 */
function getHmacKey(): Buffer {
  const blindKey = process.env.BLIND_INDEX_KEY
  if (blindKey) {
    return Buffer.from(blindKey, 'hex')
  }

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
 *
 * ## Why HMAC-SHA256 and not bcrypt/scrypt/argon2
 *
 * CodeQL flags this as `js/insufficient-password-hash`, reading the tokens that
 * reach it as passwords. That query targets *user-chosen* secrets, and the
 * reasoning does not transfer here. Three reasons, in order of importance:
 *
 * 1. **A blind index must be deterministic.** bcrypt, scrypt and argon2 salt
 *    randomly per call, so the same input yields a different digest each time.
 *    They cannot support `WHERE hash = ?`. Substituting one would break every
 *    session validation, magic link, invitation and API key lookup in the app.
 *
 * 2. **The inputs are not guessable.** Slow KDFs buy time against brute force
 *    on low-entropy input. Everything hashed here is 256 bits of CSPRNG output
 *    (`randomBytes(32).toString('hex')`) or a signed JWT — not brute-forceable
 *    at any hash speed. `blindIndex.entropy.test.ts` enforces that invariant
 *    rather than leaving it as an assumption.
 *
 * 3. **It is keyed.** An attacker holding the database but not BLIND_INDEX_KEY
 *    cannot compute candidate digests at all, which is a stronger position than
 *    an unkeyed password digest of the same data.
 *
 * User passwords do NOT come through here — `core/auth/password.ts` uses bcrypt,
 * which is correct. **If you ever route a user-chosen secret into this function,
 * the CodeQL alert becomes true and this comment becomes wrong.** That is the
 * condition to watch for.
 *
 * Known residual property: `emailHash` indexes an email address, which is
 * low-entropy and enumerable. Anyone holding both the database and
 * BLIND_INDEX_KEY could confirm whether a given address is registered. That is
 * inherent to blind indexing and is addressed by key management, not by a slower
 * hash.
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
