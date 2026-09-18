import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { sql } from 'drizzle-orm'
import {
  getTestDb,
  truncateAll,
  closeTestDb,
  testDatabaseUrl,
} from '@unblocks/blocks/testing/integration'

/**
 * The upgrade path, against a real Postgres.
 *
 * This is the case Copilot raised on the PR and it is a genuine hazard: an
 * install that predates `privacy.encryptUserEmail` holds plaintext rows, the
 * shipped default is encrypted, and nothing gates startup. Deploy the new code
 * without migrating and the app comes up and fails every sign-in.
 *
 * So the migration is the thing that has to work, and it runs exactly once,
 * against real data, on an install that is already down. That is the worst
 * possible place to discover a bug, which is why it is tested here rather than
 * only documented.
 */

const { mode } = vi.hoisted(() => ({ mode: { encryptUserEmail: false } }))

vi.mock('@unblocks/core/runtime/configLoader', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@unblocks/core/runtime/configLoader')>()
  return {
    ...actual,
    loadConfig: vi.fn((key: string) =>
      key === 'app'
        ? { ...actual.loadConfig('app'), privacy: { ...mode } }
        : actual.loadConfig(key as 'auth')
    ),
  }
})

vi.mock('@unblocks/core/runtime/hookRunner', () => ({
  runHook: vi.fn(async () => undefined),
}))

beforeAll(() => {
  process.env.DATABASE_URL = testDatabaseUrl()
  process.env.ENCRYPTION_KEY = 'a'.repeat(64)
  process.env.BLIND_INDEX_KEY = 'b'.repeat(64)
})

afterAll(async () => {
  await closeTestDb()
})

beforeEach(async () => {
  await truncateAll()
  mode.encryptUserEmail = false
  vi.clearAllMocks()
})

describe('migrateEmailStorage', () => {
  it('carries a plaintext install into encrypted mode without losing anyone', async () => {
    const { createUser } = await import('@unblocks/core/auth/createUser')
    const { getUserByEmail } = await import('@unblocks/core/auth/permissions')
    const { migrateEmailStorage } = await import('./migrate-email-storage')
    const { assertPiiStorageMatchesData } = await import(
      '@unblocks/core/security/piiStorageCheck'
    )

    // An install from before the setting existed.
    await createUser({ email: 'existing@example.com', password: 'pw-12345678' })
    await createUser({ email: 'second@example.com', password: 'pw-12345678' })

    // The upgrade: new code, new default, old rows.
    mode.encryptUserEmail = true

    // Precisely the broken state — this is what an operator hits if they skip
    // the migration, and the reason it must not be silent.
    await expect(getUserByEmail('existing@example.com')).resolves.toBeNull()
    await expect(assertPiiStorageMatchesData()).rejects.toThrow(
      /stored the other way/i
    )

    const counts = await migrateEmailStorage()
    expect(counts.users).toBe(2)

    // Everyone is findable again, and the address survived intact.
    expect((await getUserByEmail('existing@example.com'))?.email).toBe(
      'existing@example.com'
    )
    expect((await getUserByEmail('second@example.com'))?.email).toBe(
      'second@example.com'
    )
    await expect(assertPiiStorageMatchesData()).resolves.toBeUndefined()

    // And the plaintext really is gone, not merely shadowed.
    const db = getTestDb()
    const [row] = (
      await db.execute(sql`SELECT email, email_encrypted FROM users LIMIT 1`)
    ).rows as Array<{ email: string | null; email_encrypted: string | null }>
    expect(row.email).toBeNull()
    expect(row.email_encrypted).not.toBeNull()
  })

  it('migrates pending links and invitations too, not just users', async () => {
    // These tables follow the same switch. Leaving them behind would strand an
    // outstanding magic link and break the duplicate-invitation check.
    const { createUser } = await import('@unblocks/core/auth/createUser')
    const { createMagicLink, peekMagicLink } = await import(
      '@unblocks/core/auth/magicLink'
    )
    const { createTeam } = await import('@unblocks/core/teams/createTeam')
    const { inviteMember } = await import('@unblocks/core/teams/inviteMember')
    const { migrateEmailStorage } = await import('./migrate-email-storage')

    const owner = await createUser({
      email: 'owner@example.com',
      password: 'pw-12345678',
    })
    const team = await createTeam(owner.id, owner.email, 'Acme', 'acme')
    await inviteMember(team.id, 'invitee@example.com', 'member', owner.id)
    const token = await createMagicLink('pending@example.com')

    mode.encryptUserEmail = true
    const counts = await migrateEmailStorage()

    expect(counts.verification_tokens).toBeGreaterThan(0)
    expect(counts.team_invitations).toBe(1)

    // The emailed link still resolves to the right account.
    expect((await peekMagicLink(token))?.email).toBe('pending@example.com')

    // And the duplicate check still sees the migrated invitation.
    await expect(
      inviteMember(team.id, 'invitee@example.com', 'member', owner.id)
    ).rejects.toThrow(/already been invited/i)
  })

  it('is safe to run twice', async () => {
    // Re-running after a partial or interrupted migration must not double-write
    // or fail — an operator whose first run died halfway needs to just run it
    // again.
    const { createUser } = await import('@unblocks/core/auth/createUser')
    const { getUserByEmail } = await import('@unblocks/core/auth/permissions')
    const { migrateEmailStorage } = await import('./migrate-email-storage')

    await createUser({ email: 'twice@example.com', password: 'pw-12345678' })

    mode.encryptUserEmail = true
    expect((await migrateEmailStorage()).users).toBe(1)
    expect((await migrateEmailStorage()).users).toBe(0)

    expect((await getUserByEmail('twice@example.com'))?.email).toBe(
      'twice@example.com'
    )
  })

  it('runs in the other direction, for backing the choice out', async () => {
    const { createUser } = await import('@unblocks/core/auth/createUser')
    const { getUserByEmail } = await import('@unblocks/core/auth/permissions')
    const { migrateEmailStorage } = await import('./migrate-email-storage')

    mode.encryptUserEmail = true
    await createUser({ email: 'back@example.com', password: 'pw-12345678' })

    mode.encryptUserEmail = false
    expect((await migrateEmailStorage()).users).toBe(1)

    expect((await getUserByEmail('back@example.com'))?.email).toBe(
      'back@example.com'
    )

    const db = getTestDb()
    const [row] = (
      await db.execute(
        sql`SELECT email, email_encrypted, email_hash FROM users LIMIT 1`
      )
    ).rows as Array<{
      email: string | null
      email_encrypted: string | null
      email_hash: string | null
    }>
    expect(row.email).toBe('back@example.com')
    expect(row.email_encrypted).toBeNull()
    expect(row.email_hash).toBeNull()
  })
})
