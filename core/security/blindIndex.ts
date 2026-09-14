import { createHmac, pbkdf2Sync } from 'crypto'

/**
 * Returns the index key. Both derivations use it to build their salt, so it is
 * what makes them keyed: without it an attacker holding the database cannot
 * compute candidate digests at all.
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
/** 32 bytes as hex — what both BLIND_INDEX_KEY and ENCRYPTION_KEY are documented as. */
const KEY_HEX = /^[0-9a-fA-F]{64}$/

function getHmacKey(): Buffer {
  const blindKey = process.env.BLIND_INDEX_KEY
  if (blindKey) {
    // Validate, do not just decode. Buffer.from(value, 'hex') stops at the
    // first non-hex character and returns whatever it managed to read — so a
    // typo silently yields a short or EMPTY key, and every index becomes
    // computable by anyone holding the database. That matters most for the
    // email indexes, which are enumerable and rely on the key for their
    // protection. Fail closed instead.
    if (!KEY_HEX.test(blindKey)) {
      throw new Error(
        'BLIND_INDEX_KEY must be exactly 64 hex characters (32 bytes)'
      )
    }
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
 * Iteration count for {@link blindIndex}.
 *
 * 1000 is the floor RFC 2898 states for PBKDF2 — the lowest count the spec
 * itself sanctions. That is the right end of the range to sit at here, because
 * the work factor is buying no security at all (see the note on blindIndex);
 * it exists only so the derivation is a recognised KDF.
 *
 * **This number is a pure cost.** Every authenticated request and every API
 * call runs one of these *synchronously*, so it is an event-loop stall and a
 * throughput ceiling, not just added latency. Measured with
 * `npm run bench:blind-index`:
 *
 *   HMAC-SHA256 (what this replaced)   0.0045 ms
 *   PBKDF2 1000                        0.45   ms   (~2200 req/s per core)
 *   PBKDF2 4096                        1.82   ms   (~550 req/s per core)
 *
 * Those numbers were measured because an earlier version of this comment
 * asserted 4096 cost "about a quarter of a millisecond". It cost 1.82 ms. Run
 * the benchmark rather than estimating.
 *
 * Do NOT reuse this constant for a user-chosen secret. Passwords go to bcrypt
 * in core/auth/password.ts, and enumerable values go to {@link slowBlindIndex},
 * which is ~580x slower on purpose.
 */
const FAST_ITERATIONS = 1000

/**
 * Generates a deterministic blind index for a plaintext value.
 *
 * Use this for WHERE clause lookups on encrypted or one-way stored fields:
 *   - Store: key_hash = blindIndex(apiKey)
 *   - Query: WHERE key_hash = blindIndex(presentedKey)
 *
 * The index is deterministic (same input = same output) so it can back an
 * equality lookup, but it cannot be reversed to recover the original value.
 *
 * ## Why PBKDF2 with a low work factor, and not HMAC or bcrypt
 *
 * Three constraints pull in different directions, and this is the construction
 * that satisfies all of them:
 *
 * 1. **It must be deterministic.** bcrypt, scrypt and argon2 generate a random
 *    salt per call, so the same input yields a different digest every time.
 *    They cannot support `WHERE hash = ?` at all. That rules them out
 *    regardless of anything else — including for API keys, where creation and
 *    validation must derive the identical value or no key would ever match.
 *    PBKDF2 takes the salt as an argument, so it can be derived deterministically
 *    from the index key instead.
 *
 * 2. **It must be cheap.** validateSession runs on every authenticated request
 *    and validateApiKey on every API call. The work factor here is therefore
 *    a per-request latency cost paid by every user, forever.
 *
 * 3. **It must not read as a bare MAC over a credential.** A plain
 *    `createHmac('sha256', key)` over a token is indistinguishable, to a static
 *    analyser, from hashing a password with a fast digest — CodeQL raised
 *    `js/insufficient-password-hash` against exactly that. PBKDF2 is a
 *    recognised KDF, so the construction no longer has to be argued about.
 *
 * **Be clear about what the work factor is doing: nothing.** Iteration count
 * multiplies an attacker's cost per guess, and every secret reaching this
 * function is 256 bits of CSPRNG output or a signed JWT. Guessing is infeasible
 * at any speed, so 1000 iterations is no stronger than 1 against the actual
 * threat. What it costs is real and the benefit is presentational, so keep the
 * count at the floor — do not raise it thinking you are hardening something.
 *
 * If you would rather not pay that cost at all, the honest alternative is a
 * bare `createHmac` here plus dismissing the CodeQL alert as a false positive.
 * That is a defensible choice and was the prior state; it was traded away for a
 * green check that needs no per-contributor explanation.
 *
 * What *does* carry weight here is the keying: an attacker holding the database
 * but not BLIND_INDEX_KEY cannot compute candidate digests at all.
 *
 * User passwords must never come through here — `core/auth/password.ts` uses
 * bcrypt, which is correct, and `blindIndex.entropy.test.ts` asserts that
 * separation. Low-entropy-but-enumerable inputs belong in
 * {@link slowBlindIndex}: `emailHash` uses it, because an email address is the
 * one input where the work factor genuinely buys something.
 */
export function blindIndex(value: string): string {
  const digest = pbkdf2Sync(
    value.toLowerCase(),
    deriveSalt('unblocks-blind-index-salt'),
    FAST_ITERATIONS,
    32,
    'sha256'
  )

  // 32 bytes as hex is 64 characters, which is exactly the width of every
  // *_hash column. Do not widen the output without a migration.
  return digest.toString('hex')
}

/**
 * Deterministic, deployment-specific salt derived from the index key.
 *
 * A random salt would break equality lookup, which is the whole reason bcrypt
 * and argon2 cannot be used here. The domain separator keeps the fast and slow
 * derivations from producing related outputs for the same input.
 */
function deriveSalt(domain: string): Buffer {
  return createHmac('sha256', getHmacKey()).update(domain).digest()
}

/**
 * Iteration count for {@link slowBlindIndex}. OWASP's current guidance for
 * PBKDF2-HMAC-SHA256 is 600,000. Tunable via BLIND_INDEX_ITERATIONS for
 * deployments that need to trade cost against latency — but see the warning on
 * slowBlindIndex before lowering it.
 */
function getIterations(): number {
  const raw = Number(process.env.BLIND_INDEX_ITERATIONS)

  // Integer, not merely finite: pbkdf2Sync throws on a fractional iteration
  // count, so `BLIND_INDEX_ITERATIONS=10000.5` passed a `Number.isFinite`
  // check and then broke every slow derivation at runtime. Malformed config
  // falls back to the default instead.
  return Number.isInteger(raw) && raw >= 10_000 ? raw : 600_000
}

/** Distinguishes slow digests from fast ones in the same column. */
const SLOW_INDEX_PREFIX = 'pbkdf2$'

/**
 * Deterministic blind index with deliberate computational cost (PBKDF2-SHA256).
 *
 * Use this for **low-entropy, enumerable** inputs — email addresses, phone
 * numbers, postcodes. Use {@link blindIndex} for high-entropy secrets.
 *
 * Both are PBKDF2 now; the difference is the work factor, and the distinction
 * is the whole point. Iteration count multiplies an attacker's cost per
 * *guess*, so it only helps where guessing is feasible:
 *
 *   - Email address: ~2^30 realistic candidates. A cheap derivation lets an
 *     attacker holding the database AND the key confirm registrations at GPU
 *     speed. 600k iterations makes that roughly five orders of magnitude more
 *     expensive. Worth paying, and it only runs at signup, OAuth and
 *     magic-link request.
 *   - 256-bit random token: 2^256 candidates. No iteration count makes that
 *     feasible, so the cost buys exactly nothing — while landing on the hot
 *     path, since validateSession derives an index on every authenticated
 *     request and validateApiKey on every API call.
 *
 * So this is NOT a drop-in replacement for blindIndex. Routing the token paths
 * through it would add hundreds of milliseconds to every request in exchange
 * for no security. `blindIndex.entropy.test.ts` asserts the separation.
 *
 * Deterministic, like the fast variant, so it remains usable for
 * `WHERE hash = ?`.
 */
export function slowBlindIndex(value: string): string {
  const digest = pbkdf2Sync(
    value.toLowerCase(),
    deriveSalt('unblocks-slow-blind-index-salt'),
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
