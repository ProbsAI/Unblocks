import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { sql, eq } from 'drizzle-orm'
import {
  getTestDb,
  truncateAll,
  closeTestDb,
  testDatabaseUrl,
  seedUser,
} from '@unblocks/blocks/testing/integration'
import { apiKeys } from '@unblocks/core/db/schema/apiKeys'

/**
 * API key lifecycle against a real Postgres.
 *
 * This suite exists because the rest of the API key coverage mocks the Drizzle
 * builder, and CLAUDE.md's own rule says database-dependent behaviour gets an
 * integration test. The mocked tests cannot verify the blind-index lookup, the
 * revoked and expired predicates, the unique constraint, the lastUsedAt write,
 * or that the one-way storage contract actually holds in the table — which is
 * the whole security argument for how keys are stored.
 */

vi.mock('../runtime/hookRunner', () => ({
  runHook: vi.fn(async () => undefined),
}))

let userId = ''

/** Length of the `ub_live_` prefix, used to isolate the random half. */
const API_KEY_RANDOM_START = 'ub_live_'.length

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
  userId = await seedUser({
    email: 'keyholder@example.com',
    name: 'Key Holder',
  })
})

describe('API keys — issuance', () => {
  it('persists a key that validates, and returns the secret exactly once', async () => {
    const { createApiKey } = await import('./create')
    const { validateApiKey } = await import('./validate')

    const { key, apiKey } = await createApiKey(userId, { name: 'Production' })

    expect(key).toMatch(/^ub_live_[0-9a-f]{64}$/)
    expect(apiKey.prefix.length).toBeLessThan(key.length)

    const validation = await validateApiKey(key)
    expect(validation.valid).toBe(true)
    expect(validation.userId).toBe(userId)
  })

  it('stores no reversible copy of the key', async () => {
    const { createApiKey } = await import('./create')
    const { key } = await createApiKey(userId, { name: 'Production' })

    // The secret must not appear anywhere in the row. A mocked test cannot
    // check this: it asserts what was passed to a fake insert, not what the
    // table actually holds.
    const db = getTestDb()
    const rows = await db.execute(
      sql`SELECT * FROM api_keys WHERE user_id = ${userId}`
    )
    const serialised = JSON.stringify(rows.rows)

    expect(serialised).not.toContain(key)
    expect(serialised).not.toContain(key.slice(API_KEY_RANDOM_START))
  })

  it('rejects a second key colliding on the blind index', async () => {
    const db = getTestDb()
    await db.insert(apiKeys).values({
      userId,
      name: 'First',
      prefix: 'ub_live_aaaaaaaa',
      keyHash: 'duplicate-hash',
      scopes: ['*'],
    })

    await expect(
      db.insert(apiKeys).values({
        userId,
        name: 'Second',
        prefix: 'ub_live_bbbbbbbb',
        keyHash: 'duplicate-hash',
        scopes: ['*'],
      })
    ).rejects.toThrow()
  })
})

describe('API keys — validation predicates', () => {
  it('rejects a revoked key', async () => {
    const { createApiKey } = await import('./create')
    const { revokeApiKey } = await import('./revoke')
    const { validateApiKey } = await import('./validate')

    const { key, apiKey } = await createApiKey(userId, { name: 'Doomed' })
    await revokeApiKey(apiKey.id, userId)

    expect((await validateApiKey(key)).valid).toBe(false)
  })

  it('rejects an expired key', async () => {
    const { createApiKey } = await import('./create')
    const { validateApiKey } = await import('./validate')

    const { key, apiKey } = await createApiKey(userId, {
      name: 'Short lived',
      expiresInDays: 1,
    })

    // Move expiry into the past rather than waiting.
    const db = getTestDb()
    await db
      .update(apiKeys)
      .set({ expiresAt: new Date(Date.now() - 60_000) })
      .where(eq(apiKeys.id, apiKey.id))

    expect((await validateApiKey(key)).valid).toBe(false)
  })

  it('rejects a well-formed key that was never issued', async () => {
    const { validateApiKey } = await import('./validate')
    expect((await validateApiKey(`ub_live_${'0'.repeat(64)}`)).valid).toBe(false)
  })

  it('records lastUsedAt on a successful validation', async () => {
    const { createApiKey } = await import('./create')
    const { validateApiKey } = await import('./validate')

    const { key, apiKey } = await createApiKey(userId, { name: 'Tracked' })
    await validateApiKey(key)

    // The write is fire-and-forget, so poll briefly rather than asserting
    // immediately and making this flaky.
    const db = getTestDb()
    let lastUsedAt: Date | null = null
    for (let attempt = 0; attempt < 20 && lastUsedAt === null; attempt++) {
      const [row] = await db
        .select({ lastUsedAt: apiKeys.lastUsedAt })
        .from(apiKeys)
        .where(eq(apiKeys.id, apiKey.id))
      lastUsedAt = row?.lastUsedAt ?? null
      if (lastUsedAt === null) await new Promise((r) => setTimeout(r, 25))
    }

    expect(lastUsedAt).not.toBeNull()
  })
})

describe('API keys — listing and revocation', () => {
  it('excludes revoked keys by default and includes them on request', async () => {
    const { createApiKey } = await import('./create')
    const { revokeApiKey } = await import('./revoke')
    const { listApiKeys } = await import('./list')

    await createApiKey(userId, { name: 'Active' })
    const { apiKey: doomed } = await createApiKey(userId, { name: 'Revoked' })
    await revokeApiKey(doomed.id, userId)

    // The revoked filter is a SQL predicate, so only a real database exercises
    // it — this is precisely what the mocked list test could not assert.
    const visible = await listApiKeys(userId)
    expect(visible.map((k) => k.name)).toEqual(['Active'])

    const all = await listApiKeys(userId, true)
    expect(all).toHaveLength(2)
  })

  it('refuses to revoke another user’s key', async () => {
    const { createApiKey } = await import('./create')
    const { revokeApiKey } = await import('./revoke')

    const { apiKey } = await createApiKey(userId, { name: 'Mine' })

    const db = getTestDb()
    const otherId = await seedUser({
      email: 'attacker@example.com',
      name: 'Attacker',
    })

    await expect(revokeApiKey(apiKey.id, otherId)).rejects.toThrow(
      /cannot revoke/i
    )

    // And the key must remain unrevoked.
    const [row] = await db
      .select({ revokedAt: apiKeys.revokedAt })
      .from(apiKeys)
      .where(eq(apiKeys.id, apiKey.id))
    expect(row.revokedAt).toBeNull()
  })

  it('reports a missing key as not found, without the doubled suffix', async () => {
    const { revokeApiKey } = await import('./revoke')

    await expect(
      revokeApiKey('11111111-1111-1111-1111-111111111111', userId)
    ).rejects.toThrow(/^API key not found$/)
  })
})
