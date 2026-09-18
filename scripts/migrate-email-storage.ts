/**
 * Move stored email addresses into whichever columns the configured mode uses.
 *
 * Run with: npm run db:migrate-email-storage
 *
 * `privacy.encryptUserEmail` decides which column holds an address, and a
 * lookup in one mode cannot match a row written in the other. So an install
 * that already has users cannot simply adopt a different value — every sign-in
 * would miss, which looks like the accounts vanishing rather than like a config
 * change. This is the path between the two modes.
 *
 * Existing installs upgrading past the release that introduced the setting are
 * exactly that case: their rows are plaintext and the shipped default is
 * encrypted. Run this once, after deploying the new code and before letting
 * users back in.
 *
 * Safe to re-run: it only touches rows stored the other way, so a second run
 * finds nothing to do. It is not safe to run while the application is serving —
 * a row rewritten underneath a request is a request that misses.
 */
import { eq, isNotNull } from 'drizzle-orm'
import { getDb, closeDb } from '../core/db/client'
import { users } from '../core/db/schema/users'
import { verificationTokens } from '../core/db/schema/verificationTokens'
import { teamInvitations } from '../core/db/schema/teams'
import {
  piiEncryptionEnabled,
  emailColumns,
  emailValueColumns,
  readEmail,
} from '../core/security/piiStorage'

/** Rows are handled in batches so a large table does not land in memory at once. */
const BATCH = 500

interface StoredAddress {
  id: string
  email: string | null
  emailEncrypted: string | null
}

/**
 * Drive one table to completion.
 *
 * The caller supplies the two table-specific halves — reading a batch of rows
 * stored the wrong way, and rewriting one row — because Drizzle's builders are
 * typed per table and a union of the three does not type-check. Keeping the
 * loop here means the batching and the "did anything change" accounting exist
 * once.
 */
async function migrateTable(
  label: string,
  readStaleBatch: () => Promise<StoredAddress[]>,
  writeRow: (id: string, address: string) => Promise<void>
): Promise<number> {
  let migrated = 0

  for (;;) {
    const rows = await readStaleBatch()
    if (rows.length === 0) break

    for (const row of rows) {
      // readEmail takes the address from whichever column currently holds it,
      // so this works in both directions with no branch here.
      const address = readEmail(row)

      if (!address) {
        throw new Error(
          `${label} row ${row.id} has no readable address. Its ciphertext may ` +
            'have been written with a different ENCRYPTION_KEY; resolve that ' +
            'before migrating.'
        )
      }

      await writeRow(row.id, address)
      migrated++
    }

    console.log(`[email-storage] ${label}: ${migrated} rows rewritten`)
  }

  return migrated
}

/**
 * Rewrite every stored address into the configured mode's columns.
 *
 * Exported so the upgrade path can be tested rather than only run. An untested
 * migration is the worst place to be wrong: it executes once, against real
 * data, on an install that is already down.
 */
export async function migrateEmailStorage(): Promise<Record<string, number>> {
  const db = getDb()
  const encrypted = piiEncryptionEnabled()

  // Rows stored the OTHER way: in encrypted mode anything still carrying
  // plaintext, in plaintext mode anything still carrying ciphertext.
  const staleUsers = encrypted
    ? isNotNull(users.email)
    : isNotNull(users.emailEncrypted)
  const staleTokens = encrypted
    ? isNotNull(verificationTokens.email)
    : isNotNull(verificationTokens.emailEncrypted)
  const staleInvites = encrypted
    ? isNotNull(teamInvitations.email)
    : isNotNull(teamInvitations.emailEncrypted)

  const counts = {
    // users and team_invitations are looked up BY address, so they get the
    // blind index. verification_tokens is only ever found by token_hash.
    users: await migrateTable(
      'users',
      () =>
        db
          .select({
            id: users.id,
            email: users.email,
            emailEncrypted: users.emailEncrypted,
          })
          .from(users)
          .where(staleUsers)
          .limit(BATCH),
      async (id, address) => {
        await db
          .update(users)
          .set(emailColumns(address))
          .where(eq(users.id, id))
      }
    ),

    verification_tokens: await migrateTable(
      'verification_tokens',
      () =>
        db
          .select({
            id: verificationTokens.id,
            email: verificationTokens.email,
            emailEncrypted: verificationTokens.emailEncrypted,
          })
          .from(verificationTokens)
          .where(staleTokens)
          .limit(BATCH),
      async (id, address) => {
        await db
          .update(verificationTokens)
          .set(emailValueColumns(address))
          .where(eq(verificationTokens.id, id))
      }
    ),

    team_invitations: await migrateTable(
      'team_invitations',
      () =>
        db
          .select({
            id: teamInvitations.id,
            email: teamInvitations.email,
            emailEncrypted: teamInvitations.emailEncrypted,
          })
          .from(teamInvitations)
          .where(staleInvites)
          .limit(BATCH),
      async (id, address) => {
        await db
          .update(teamInvitations)
          .set(emailColumns(address))
          .where(eq(teamInvitations.id, id))
      }
    ),
  }

  return counts
}

async function main(): Promise<void> {
  console.log(
    `[email-storage] Target mode: privacy.encryptUserEmail = ${piiEncryptionEnabled()}`
  )
  console.log('[email-storage] Stop the application before running this.')

  const counts = await migrateEmailStorage()
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0)

  console.log('[email-storage] Done.')
  for (const [table, n] of Object.entries(counts)) {
    console.log(`[email-storage]   ${table}: ${n}`)
  }

  if (total === 0) {
    console.log(
      '[email-storage] Nothing to migrate — the data already matches the mode.'
    )
  }

  await closeDb()
}

// Only when invoked as a script. Importing this module — which the integration
// test does — must not start rewriting a database.
if (process.argv[1] && process.argv[1].includes('migrate-email-storage')) {
  main().catch(async (error) => {
    console.error('[email-storage] Failed:', error)
    await closeDb().catch(() => {})
    process.exit(1)
  })
}
