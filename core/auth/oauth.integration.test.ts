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
 * account sharing its email address without either side proving control of it.
 * There are two halves, and fixing only the first leaves the door open:
 *
 *   1. Provider side. An attacker registers an identity at a provider that does
 *      not verify addresses and claims the victim's account.
 *   2. Local side. An attacker registers victim@example.com locally and never
 *      verifies it. verifyCredentials checks status, not emailVerified, so the
 *      attacker can still sign in — and when the real owner later arrives with a
 *      genuinely verified provider identity, it is linked to the ATTACKER's
 *      account and the attacker's password keeps working.
 *
 * Linking now requires both sides to be verified.
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

async function seedLocalUser(
  email: string,
  emailVerified = false
): Promise<string> {
  const db = getTestDb()
  const [row] = (
    await db.execute(sql`
      INSERT INTO users (email, name, email_verified)
      VALUES (${email}, 'Existing User', ${emailVerified})
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

  it('refuses to link when the LOCAL account is unverified', async () => {
    // seedLocalUser creates the account with email_verified = false.
    //
    // This is the second half of the takeover path, and checking only the
    // provider's flag left it open: verifyCredentials permits an unverified
    // local account to sign in, so an attacker registers the victim's address,
    // never verifies it, and the victim's genuinely-verified provider identity
    // gets linked to the attacker's account.
    const victimId = await seedLocalUser('unverified-victim@example.com')
    const { handleOAuthCallback, OAuthLinkRequiredError } = await import('./oauth')

    await expect(
      handleOAuthCallback('google', 'google-victim-sub', 'tok', null, {
        email: 'unverified-victim@example.com',
        name: 'Victim',
        avatarUrl: '',
        emailVerified: true,
      })
    ).rejects.toBeInstanceOf(OAuthLinkRequiredError)

    const db = getTestDb()
    const linked = await db
      .select()
      .from(accounts)
      .where(eq(accounts.userId, victimId))

    expect(linked).toHaveLength(0)
  })

  it('links when both the provider and the local account are verified', async () => {
    const userId = await seedLocalUser('owner@example.com', true)
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

  it('leaves an existing account\u2019s verification state untouched', async () => {
    // The stronger rule above means an unverified local account is never linked
    // at all, so the remaining case is that linking a verified one does not
    // rewrite state that belongs to this app's own verification flow.
    const userId = await seedLocalUser('settled@example.com', true)
    const { handleOAuthCallback } = await import('./oauth')

    await handleOAuthCallback('google', 'sub-settled', 'tok', null, {
      email: 'settled@example.com',
      name: 'Someone',
      avatarUrl: '',
      emailVerified: true,
    })

    const db = getTestDb()
    const [row] = await db.select().from(users).where(eq(users.id, userId))

    expect(row.emailVerified).toBe(true)
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
