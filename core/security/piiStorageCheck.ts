import { sql } from 'drizzle-orm'
import { getDb } from '../db/client'
import { piiEncryptionEnabled } from './piiStorage'

/**
 * Throw when the configured mode disagrees with the stored data.
 *
 * Without this the failure is silent and looks like every account vanishing:
 * lookups simply match nothing.
 *
 * Today the only caller is `/api/health`, which reports it as
 * `piiStorage: unhealthy`. That catches the mismatch when someone looks, which
 * is not the same as refusing to serve — a deployment in this state still
 * starts and still fails every sign-in. Calling it from a boot hook would make
 * it a hard gate; that is a deliberate operational choice (a transient DB
 * outage would then also block startup), so it is left to the operator rather
 * than assumed here.
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
