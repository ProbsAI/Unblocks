import { createHmac, pbkdf2Sync } from 'crypto'

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
 * Low-entropy inputs do NOT belong here. `emailHash` used to use this function
 * and now uses {@link slowBlindIndex}, because an email address is enumerable
 * and therefore the one place where iteration count actually buys something.
 */
export function blindIndex(value: string): string {
  const key = getHmacKey()
  return createHmac('sha256', key).update(value.toLowerCase()).digest('hex')
}

/**
 * Iteration count for {@link slowBlindIndex}. OWASP's current guidance for
 * PBKDF2-HMAC-SHA256 is 600,000. Tunable via BLIND_INDEX_ITERATIONS for
 * deployments that need to trade cost against latency — but see the warning on
 * slowBlindIndex before lowering it.
 */
function getIterations(): number {
  const raw = Number(process.env.BLIND_INDEX_ITERATIONS)
  return Number.isFinite(raw) && raw >= 10_000 ? raw : 600_000
}

/** Distinguishes slow digests from fast ones in the same column. */
const SLOW_INDEX_PREFIX = 'pbkdf2$'

/**
 * Deterministic blind index with deliberate computational cost (PBKDF2-SHA256).
 *
 * Use this for **low-entropy, enumerable** inputs — email addresses, phone
 * numbers, postcodes. Use {@link blindIndex} for high-entropy secrets.
 *
 * The distinction is the whole point. Iteration count multiplies an attacker's
 * cost per *guess*, so it only helps when guessing is feasible:
 *
 *   - Email address: ~2^30 realistic candidates. HMAC-SHA256 lets an attacker
 *     holding the database AND the key confirm registrations at GPU speed.
 *     600k PBKDF2 iterations makes that roughly five orders of magnitude more
 *     expensive. Worth paying.
 *   - 256-bit random token: 2^256 candidates. No iteration count makes that
 *     feasible, so the cost buys exactly nothing — while landing on the hot
 *     path, since validateSession hashes a token on every authenticated
 *     request and validateApiKey on every API call.
 *
 * That is why this is NOT a drop-in replacement for blindIndex, and why the
 * CodeQL `js/insufficient-password-hash` alert should not be "fixed" by
 * switching the token paths over. Doing so would add hundreds of milliseconds
 * to every request in exchange for no security.
 *
 * Still deterministic, so it remains usable for `WHERE hash = ?`. The salt is
 * derived from the index key with a domain separator rather than generated per
 * call — a random salt would break equality lookup, which is exactly why
 * bcrypt and argon2 cannot be used here at all.
 */
export function slowBlindIndex(value: string): string {
  const key = getHmacKey()

  // Deterministic, deployment-specific salt. Domain-separated from the HMAC use
  // so the two constructions cannot produce related outputs.
  const salt = createHmac('sha256', key)
    .update('unblocks-slow-blind-index-salt')
    .digest()

  const digest = pbkdf2Sync(
    value.toLowerCase(),
    salt,
    getIterations(),
    32,
    'sha256'
  )

  return `${SLOW_INDEX_PREFIX}${digest.toString('hex')}`
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
