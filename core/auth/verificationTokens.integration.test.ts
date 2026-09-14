import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { sql } from 'drizzle-orm'
import {
  getTestDb,
  truncateAll,
  closeTestDb,
  testDatabaseUrl,
  seedUser,
} from '@unblocks/blocks/testing/integration'

/**
 * Single-use really means single-use, under concurrency.
 *
 * Every consumer of `verification_tokens` used to read the row, check
 * `used_at IS NULL`, and then mark it used. Between the read and the write a
 * second request reads the same row and sees the same null, so both proceed:
 * two sessions from one magic link, two resets from one reset link. Single use
 * was enforced only by how fast the two requests happened to arrive.
 *
 * The confirmation interstitial made this easier to hit rather than harder —
 * the emailed link now lands on a page with a button, and a double click or a
 * retried submit issues two POSTs.
 *
 * A mocked query builder cannot see any of this: it has no row locks, so both
 * callers "win" no matter how the code is written. That is the whole reason
 * these run against a real Postgres.
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

async function usedCount(): Promise<number> {
  const db = getTestDb()
  const result = await db.execute(sql`
    SELECT COUNT(*)::int AS n FROM verification_tokens WHERE used_at IS NOT NULL
  `)
  return (result.rows as Array<{ n: number }>)[0].n
}

describe('claimVerificationToken', () => {
  it('lets exactly one of two concurrent callers win', async () => {
    const { createMagicLink } = await import('./magicLink')
    const { claimVerificationToken } = await import('./verificationTokens')

    const token = await createMagicLink('race@example.com')

    // Issued together, so both are in flight before either commits. This is
    // the case a read-then-write loses.
    const [first, second] = await Promise.all([
      claimVerificationToken(token, 'magic_link'),
      claimVerificationToken(token, 'magic_link'),
    ])

    const winners = [first, second].filter(Boolean)
    expect(winners).toHaveLength(1)
    expect(await usedCount()).toBe(1)
  })

  it('refuses a token that was already claimed', async () => {
    const { createMagicLink } = await import('./magicLink')
    const { claimVerificationToken } = await import('./verificationTokens')

    const token = await createMagicLink('once@example.com')

    expect(await claimVerificationToken(token, 'magic_link')).not.toBeNull()
    expect(await claimVerificationToken(token, 'magic_link')).toBeNull()
  })

  it('refuses a token of a different type', async () => {
    // verification_tokens is shared by magic links, email verification and
    // password resets. Without the type filter a reset token would open a
    // session outright.
    const { createEmailVerificationToken } = await import('./emailVerification')
    const { claimVerificationToken } = await import('./verificationTokens')

    const token = await createEmailVerificationToken('typed@example.com')

    expect(await claimVerificationToken(token, 'magic_link')).toBeNull()
    expect(await usedCount()).toBe(0)
  })

  it('refuses an expired token', async () => {
    const { createMagicLink } = await import('./magicLink')
    const { claimVerificationToken } = await import('./verificationTokens')

    const token = await createMagicLink('expired@example.com')
    const db = getTestDb()
    await db.execute(sql`
      UPDATE verification_tokens SET expires_at = NOW() - INTERVAL '1 minute'
    `)

    expect(await claimVerificationToken(token, 'magic_link')).toBeNull()
  })

  it('refuses an unknown token without touching anything', async () => {
    const { createMagicLink } = await import('./magicLink')
    const { claimVerificationToken } = await import('./verificationTokens')

    await createMagicLink('bystander@example.com')

    expect(await claimVerificationToken('f'.repeat(64), 'magic_link')).toBeNull()
    expect(await usedCount()).toBe(0)
  })
})

describe('the consumers that depend on it', () => {
  it('issues one session per magic link, not one per request', async () => {
    const { createMagicLink, verifyMagicLink } = await import('./magicLink')

    const token = await createMagicLink('double@example.com')

    // A double-clicked confirmation button.
    const results = await Promise.allSettled([
      verifyMagicLink(token),
      verifyMagicLink(token),
    ])

    const ok = results.filter((r) => r.status === 'fulfilled')
    const failed = results.filter((r) => r.status === 'rejected')

    expect(ok).toHaveLength(1)
    expect(failed).toHaveLength(1)
  })

  it('applies one password reset per link', async () => {
    const { requestPasswordReset, resetPassword } = await import('./passwordReset')

    await seedUser({
      email: 'reset@example.com',
      name: 'Reset',
      passwordHash: 'old-hash',
    })

    const requested = await requestPasswordReset('reset@example.com')
    expect(requested).not.toBeNull()
    const token = requested!.token

    const results = await Promise.allSettled([
      resetPassword(token, 'first-new-password'),
      resetPassword(token, 'second-new-password'),
    ])

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    expect(await usedCount()).toBe(1)
  })
})
