import { sql } from 'drizzle-orm'
import { getDb } from '../db/client'
import { piiEncryptionEnabled } from './piiStorage'

/**
 * Refuse to start when the configured mode disagrees with the stored data.
 *
 * Without this the failure is silent and looks like every account vanishing:
 * lookups simply match nothing. Call it once during boot.
 */
export async function assertPiiStorageMatchesData(): Promise<void> {
  const db = getDb()
  const encrypted = piiEncryptionEnabled()

  // Count rows stored the *other* way. A fresh install has none either way and
  // is free to choose.
  const [row] = (
    await db.execute(
      encrypted
        ? sql`SELECT COUNT(*)::int AS n FROM users WHERE email IS NOT NULL`
        : sql`SELECT COUNT(*)::int AS n FROM users WHERE email_hash IS NOT NULL`
    )
  ).rows as Array<{ n: number }>

  if (row.n > 0) {
    throw new Error(
      [
        `privacy.encryptUserEmail is ${encrypted} but ${row.n} user row(s) are stored the other way.`,
        '',
        'This is an install-time choice: changing it strands existing rows,',
        'because a lookup in one mode cannot match a row written in the other.',
        '',
        encrypted
          ? 'Either set privacy.encryptUserEmail back to false, or migrate the existing rows.'
          : 'Either set privacy.encryptUserEmail back to true, or migrate the existing rows.',
      ].join('\n')
    )
  }
}
