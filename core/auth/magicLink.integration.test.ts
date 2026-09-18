import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { sql } from 'drizzle-orm'
import {
  getTestDb,
  truncateAll,
  closeTestDb,
  testDatabaseUrl,
} from '@unblocks/blocks/testing/integration'
import { users } from '@unblocks/core/db/schema/users'
import { emailMatches } from '@unblocks/core/security/piiStorage'

/**
 * Magic-link token handling, against a real Postgres.
 *
 * peekMagicLink exists so the confirmation interstitial can name the
 * destination account without burning the link. That makes two properties
 * load-bearing, and both are invisible to a mocked query builder:
 *
 *   1. peek does NOT consume. If it marked the token used, every confirmed
 *      sign-in would fail on the POST that follows — the interstitial would
 *      break the flow it exists to protect.
 *   2. peek accepts exactly what verify accepts. If peek were more permissive
 *      (an expired or already-used token), the page would promise a sign-in
 *      the POST then refuses; if it were stricter, a valid link would be
 *      rejected before the user ever saw it.
 *
 * "Same column, same filters" is precisely the class of bug a test that stubs
 * eq() into a plain object cannot see.
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

async function countUnusedTokens(): Promise<number> {
  const db = getTestDb()
  const result = await db.execute(sql`
    SELECT COUNT(*)::int AS n FROM verification_tokens WHERE used_at IS NULL
  `)
  return (result.rows as Array<{ n: number }>)[0].n
}

async function expireAllTokens(): Promise<void> {
  const db = getTestDb()
  await db.execute(sql`
    UPDATE verification_tokens SET expires_at = NOW() - INTERVAL '1 minute'
  `)
}

describe('peekMagicLink', () => {
  it('names the destination account without consuming the token', async () => {
    const { createMagicLink, peekMagicLink, verifyMagicLink } = await import(
      './magicLink'
    )

    const token = await createMagicLink('Recipient@Example.com')

    const peeked = await peekMagicLink(token)
    expect(peeked).toEqual({ email: 'recipient@example.com' })

    // Peeking twice must stay harmless — a reload of the interstitial is an
    // ordinary thing for a person to do.
    expect(await peekMagicLink(token)).toEqual({ email: 'recipient@example.com' })
    expect(await countUnusedTokens()).toBe(1)

    // And the link still works afterwards, which is the property that makes
    // the interstitial viable at all.
    const user = await verifyMagicLink(token)
    expect(user.email).toBe('recipient@example.com')
    expect(await countUnusedTokens()).toBe(0)
  })

  it('returns null once the token has been used', async () => {
    const { createMagicLink, peekMagicLink, verifyMagicLink } = await import(
      './magicLink'
    )

    const token = await createMagicLink('used@example.com')
    await verifyMagicLink(token)

    expect(await peekMagicLink(token)).toBeNull()
  })

  it('returns null for an expired token', async () => {
    const { createMagicLink, peekMagicLink } = await import('./magicLink')

    const token = await createMagicLink('expired@example.com')
    await expireAllTokens()

    expect(await peekMagicLink(token)).toBeNull()
  })

  it('returns null for a token that was never issued', async () => {
    const { peekMagicLink } = await import('./magicLink')

    expect(await peekMagicLink('f'.repeat(64))).toBeNull()
  })

  it('does not accept a token of another type', async () => {
    // verification_tokens is shared by magic links, email verification and
    // password resets. Without the type filter a password-reset token would
    // authenticate a session outright.
    const { createEmailVerificationToken } = await import('./emailVerification')
    const { peekMagicLink } = await import('./magicLink')

    const otherToken = await createEmailVerificationToken('typed@example.com')

    expect(await peekMagicLink(otherToken)).toBeNull()
  })

  it('agrees with verifyMagicLink on every token it accepts', async () => {
    // The interstitial shows what peek reports and the POST acts on what verify
    // accepts. If the two filters ever drift, the page promises a sign-in that
    // then fails — so assert them together rather than separately.
    const { createMagicLink, peekMagicLink, verifyMagicLink } = await import(
      './magicLink'
    )

    const token = await createMagicLink('agreement@example.com')
    const peeked = await peekMagicLink(token)
    expect(peeked).not.toBeNull()

    const user = await verifyMagicLink(token)
    expect(user.email).toBe(peeked!.email)
  })
})

describe('verifyMagicLink', () => {
  it('rejects a second use of the same token', async () => {
    const { createMagicLink, verifyMagicLink } = await import('./magicLink')

    const token = await createMagicLink('replay@example.com')
    await verifyMagicLink(token)

    await expect(verifyMagicLink(token)).rejects.toThrow(
      'Invalid or expired magic link'
    )
  })

  it('marks the address verified, since receiving the mail proves control', async () => {
    const { createMagicLink, verifyMagicLink } = await import('./magicLink')
    const db = getTestDb()

    const token = await createMagicLink('fresh@example.com')
    await verifyMagicLink(token)

    // Selected via emailMatches rather than `WHERE email = …`: the address
    // lives in that column only in plaintext mode, so a literal comparison
    // matches no row under the default.
    const [row] = await db
      .select({ emailVerified: users.emailVerified })
      .from(users)
      .where(emailMatches('fresh@example.com'))

    expect(row.emailVerified).toBe(true)
  })
})
