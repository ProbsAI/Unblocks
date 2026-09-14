import { eq, type SQL } from 'drizzle-orm'
import { users } from '../db/schema/users'
import { loadConfig } from '../runtime/configLoader'
import { encrypt, decrypt } from './encryption'
import { blindIndex } from './blindIndex'

/**
 * Where a user's email address actually lives, which is an install-time choice.
 *
 * Two storage modes, selected by `privacy.encryptUserEmail` in app.config.ts:
 *
 *   encrypted (default)  email = NULL
 *                        email_encrypted = AES-GCM ciphertext
 *                        email_hash = keyed blind index  <- every lookup
 *
 *   plaintext            email = the address              <- every lookup
 *                        email_encrypted = NULL
 *                        email_hash = NULL
 *
 * Both columns are nullable and both are UNIQUE. Postgres treats NULLs as
 * distinct, so whichever column is unused holds many NULLs without colliding,
 * and uniqueness still lands on exactly one real column in either mode.
 *
 * ## Why this is not a runtime toggle
 *
 * Flipping it after any user exists makes every lookup miss — a plaintext row
 * has no hash to match, an encrypted row has no plaintext to match. Sign-in
 * fails for everyone and it reads as data loss rather than a config error.
 * assertPiiStorageMatchesData (piiStorageCheck.ts) refuses to start in that
 * state instead.
 *
 * ## What encrypted mode actually buys, and costs
 *
 * Buys: a database dump alone — a leaked backup, a dumped table, a compromised
 * read replica — reveals no addresses. The index is keyed, so candidates cannot
 * be computed without BLIND_INDEX_KEY either. It does NOT protect against an
 * attacker who has the application, since they have the keys.
 *
 * Costs: substring search over email is impossible (a digest has no
 * substrings), so the admin panel falls back to exact match. And
 * BLIND_INDEX_KEY becomes as critical as your backups — lose it and no user can
 * be looked up again, ever.
 */
export function piiEncryptionEnabled(): boolean {
  return loadConfig('app').privacy.encryptUserEmail
}

/** The user-table column values for an address, in whichever mode is configured. */
export function emailColumns(email: string): {
  email: string | null
  emailEncrypted: string | null
  emailHash: string | null
} {
  const normalized = email.toLowerCase()

  if (!piiEncryptionEnabled()) {
    // Deliberately not writing ciphertext too. A column nothing reads is not
    // storage, it is exposure — the rule that removed the *_encrypted token
    // columns applies here as well.
    return { email: normalized, emailEncrypted: null, emailHash: null }
  }

  return {
    email: null,
    emailEncrypted: encrypt(normalized),
    emailHash: blindIndex(normalized),
  }
}

/** A WHERE condition matching one user by address, in whichever mode. */
export function emailMatches(email: string): SQL {
  const normalized = email.toLowerCase()

  return piiEncryptionEnabled()
    ? eq(users.emailHash, blindIndex(normalized))
    : eq(users.email, normalized)
}

/**
 * The address for a row, from whichever column holds it.
 *
 * Callers must have selected both columns. Returns '' rather than throwing for
 * a row that predates the current mode — a stale row should degrade a display
 * value, not crash a request. `assertPiiStorageMatchesData` is what surfaces
 * that situation properly, at startup — see piiStorageCheck.ts.
 */
export function readEmail(row: {
  email: string | null
  emailEncrypted: string | null
}): string {
  if (row.email) return row.email
  if (!row.emailEncrypted) return ''

  try {
    return decrypt(row.emailEncrypted)
  } catch {
    return ''
  }
}
