import { sql } from 'drizzle-orm'
import { getDb } from '../db/client'
import { piiEncryptionEnabled } from './piiStorage'

/**
 * Every table whose address storage follows `privacy.encryptUserEmail`.
 *
 * All three are checked, not just `users`. A partial migration is a real state
 * to land in — the migration script walks the tables in order, so an
 * interrupted or failed run leaves users converted and invitations not. If this
 * only looked at `users` it would report healthy while pending invitations were
 * unmatchable and outstanding magic links resolved to nothing.
 */
const TABLES = ['users', 'verification_tokens', 'team_invitations'] as const

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

  const stale: Array<{ table: string; rows: number }> = []

  for (const table of TABLES) {
    // Rows stored the *other* way. A fresh install has none either way and is
    // free to choose.
    //
    // The predicate keys off `email_encrypted` rather than `email_hash`,
    // because verification_tokens has no index column — it is never looked up
    // by address. Using the ciphertext column keeps one rule across all three,
    // and it is the same predicate the migration selects on, so the check and
    // the fix cannot disagree about what counts as stale.
    const [row] = (
      await db.execute(
        encrypted
          ? sql`SELECT COUNT(*)::int AS n FROM ${sql.identifier(table)} WHERE email IS NOT NULL`
          : sql`SELECT COUNT(*)::int AS n FROM ${sql.identifier(table)} WHERE email_encrypted IS NOT NULL`
      )
    ).rows as Array<{ n: number }>

    if (row.n > 0) stale.push({ table, rows: row.n })
  }

  if (stale.length === 0) return

  throw new Error(
    [
      `privacy.encryptUserEmail is ${encrypted} but rows are stored the other way:`,
      ...stale.map((s) => `  ${s.table}: ${s.rows} row(s)`),
      '',
      'This is an install-time choice: changing it strands existing rows,',
      'because a lookup in one mode cannot match a row written in the other.',
      '',
      'Run `npm run db:migrate-email-storage` with the application stopped, or',
      `set privacy.encryptUserEmail back to ${!encrypted}.`,
    ].join('\n')
  )
}
