import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { sql, eq } from 'drizzle-orm'
import {
  getTestDb,
  truncateAll,
  closeTestDb,
  testDatabaseUrl,
} from '@unblocks/blocks/testing/integration'
import { users } from '@unblocks/core/db/schema/users'
import { accounts } from '@unblocks/core/db/schema/accounts'

/**
 * Regression tests for OAuth account linking, against a real Postgres.
 *
 * The vulnerability: handleOAuthCallback linked an OAuth identity to any local
 * account sharing its email address, without checking whether the provider had
 * verified that address. Attack shape —
 *
 *   1. Attacker registers a password account for victim@example.com at a
 *      provider that does not verify addresses.
 *   2. Victim later signs in with that provider.
 *   3. The identity links to the existing account and the attacker's password
 *      still works: full takeover.
 *
 * getGoogleUserInfo already returned email_verified; handleOAuthCallback was
 * simply never given it.
 */

vi.mock('../runtime/hookRunner', () => ({
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
  vi.clearAllMocks()
})

async function seedLocalUser(email: string): Promise<string> {
  const db = getTestDb()
  const [row] = (
    await db.execute(sql`
      INSERT INTO users (email, name, email_verified)
      VALUES (${email}, 'Existing User', false)
      RETURNING id
    `)
  ).rows as Array<{ id: string }>
  return row.id
}

describe('handleOAuthCallback — linking to an existing account', () => {
  it('refuses to link when the provider has not verified the email', async () => {
    const victimId = await seedLocalUser('victim@example.com')
    const { handleOAuthCallback, OAuthLinkRequiredError } = await import('./oauth')

    await expect(
      handleOAuthCallback('google', 'google-attacker-sub', 'tok', null, {
        email: 'victim@example.com',
        name: 'Attacker',
        avatarUrl: '',
        emailVerified: false,
      })
    ).rejects.toBeInstanceOf(OAuthLinkRequiredError)

    // Critically: no account row may have been created for the attacker.
    const db = getTestDb()
    const linked = await db
      .select()
      .from(accounts)
      .where(eq(accounts.userId, victimId))

    expect(linked).toHaveLength(0)
  })

  it('links when the provider has verified the email', async () => {
    const userId = await seedLocalUser('owner@example.com')
    const { handleOAuthCallback } = await import('./oauth')

    const result = await handleOAuthCallback(
      'google',
      'google-owner-sub',
      'tok',
      null,
      {
        email: 'owner@example.com',
        name: 'Owner',
        avatarUrl: 'https://example.com/a.png',
        emailVerified: true,
      }
    )

    expect(result.id).toBe(userId)

    const db = getTestDb()
    const linked = await db
      .select()
      .from(accounts)
      .where(eq(accounts.userId, userId))

    expect(linked).toHaveLength(1)
    expect(linked[0].provider).toBe('google')
  })

  it('does not silently mark an existing account as email-verified', async () => {
    const userId = await seedLocalUser('unverified@example.com')
    const { handleOAuthCallback } = await import('./oauth')

    await handleOAuthCallback('google', 'sub-1', 'tok', null, {
      email: 'unverified@example.com',
      name: 'Someone',
      avatarUrl: '',
      emailVerified: true,
    })

    const db = getTestDb()
    const [row] = await db.select().from(users).where(eq(users.id, userId))

    // Verification state belongs to this app's own flow; an OAuth sign-in must
    // not retroactively assert it for a pre-existing local account.
    expect(row.emailVerified).toBe(false)
  })
})

describe('handleOAuthCallback — new users', () => {
  it('records the provider assertion rather than assuming verified', async () => {
    const { handleOAuthCallback } = await import('./oauth')

    await handleOAuthCallback('google', 'sub-new-unverified', 'tok', null, {
      email: 'fresh@example.com',
      name: 'Fresh',
      avatarUrl: '',
      emailVerified: false,
    })

    const db = getTestDb()
    const [row] = await db
      .select()
      .from(users)
      .where(eq(users.email, 'fresh@example.com'))

    expect(row).toBeDefined()
    expect(row.emailVerified).toBe(false)
  })

  it('marks a new user verified when the provider verified them', async () => {
    const { handleOAuthCallback } = await import('./oauth')

    await handleOAuthCallback('google', 'sub-new-verified', 'tok', null, {
      email: 'trusted@example.com',
      name: 'Trusted',
      avatarUrl: '',
      emailVerified: true,
    })

    const db = getTestDb()
    const [row] = await db
      .select()
      .from(users)
      .where(eq(users.email, 'trusted@example.com'))

    expect(row.emailVerified).toBe(true)
  })
})

describe('handleOAuthCallback — returning users', () => {
  it('reuses an already-linked identity without re-checking email', async () => {
    const { handleOAuthCallback } = await import('./oauth')

    const first = await handleOAuthCallback(
      'google',
      'sub-returning',
      'tok-1',
      null,
      {
        email: 'returning@example.com',
        name: 'Returning',
        avatarUrl: '',
        emailVerified: true,
      }
    )

    // An established link is proof of ownership, so a later sign-in is fine
    // even if the provider stops asserting verification.
    const second = await handleOAuthCallback(
      'google',
      'sub-returning',
      'tok-2',
      null,
      {
        email: 'returning@example.com',
        name: 'Returning',
        avatarUrl: '',
        emailVerified: false,
      }
    )

    expect(second.id).toBe(first.id)
  })
})
