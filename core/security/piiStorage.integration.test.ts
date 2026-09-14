import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { sql } from 'drizzle-orm'
import {
  getTestDb,
  truncateAll,
  closeTestDb,
  testDatabaseUrl,
} from '@unblocks/blocks/testing/integration'

/**
 * Both storage modes, end to end, against a real Postgres.
 *
 * `privacy.encryptUserEmail` decides which column a user's address lives in and
 * therefore which column every lookup matches on. That makes it exactly the
 * kind of fork that rots: one mode gets exercised, the other silently stops
 * working, and nobody notices until an adopter picks it.
 *
 * So every case here runs twice — once per mode — and the storage shape is
 * asserted directly in SQL, not through the code that wrote it.
 */

const { mode } = vi.hoisted(() => ({ mode: { encryptUserEmail: true } }))

vi.mock('../runtime/configLoader', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../runtime/configLoader')>()
  return {
    ...actual,
    loadConfig: vi.fn((key: string) =>
      key === 'app'
        ? { ...actual.loadConfig('app'), privacy: { ...mode } }
        : actual.loadConfig(key as 'auth')
    ),
  }
})

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

async function storedRow(): Promise<{
  email: string | null
  email_encrypted: string | null
  email_hash: string | null
}> {
  const db = getTestDb()
  const result = await db.execute(sql`
    SELECT email, email_encrypted, email_hash FROM users LIMIT 1
  `)
  return (
    result.rows as Array<{
      email: string | null
      email_encrypted: string | null
      email_hash: string | null
    }>
  )[0]
}

for (const encryptUserEmail of [true, false]) {
  describe(`encryptUserEmail: ${encryptUserEmail}`, () => {
    beforeEach(() => {
      mode.encryptUserEmail = encryptUserEmail
    })

    it('stores the address in exactly one column', async () => {
      const { createUser } = await import('../auth/createUser')
      await createUser({ email: 'Stored@Example.com', password: 'pw-12345678' })

      const row = await storedRow()

      if (encryptUserEmail) {
        // The point of the mode: a dump of this table reveals no address.
        expect(row.email).toBeNull()
        expect(row.email_encrypted).not.toBeNull()
        expect(row.email_encrypted).not.toContain('stored@example.com')
        expect(row.email_hash).toMatch(/^[0-9a-f]{64}$/)
      } else {
        expect(row.email).toBe('stored@example.com')
        // No unread ciphertext copy either — that was the defect removed from
        // the token tables, and it would be the same defect here.
        expect(row.email_encrypted).toBeNull()
        expect(row.email_hash).toBeNull()
      }
    })

    it('finds the user again by address', async () => {
      const { createUser } = await import('../auth/createUser')
      const { getUserByEmail } = await import('../auth/permissions')

      await createUser({ email: 'lookup@example.com', password: 'pw-12345678' })

      const found = await getUserByEmail('lookup@example.com')
      expect(found?.email).toBe('lookup@example.com')
    })

    it('normalises case on both write and lookup', async () => {
      const { createUser } = await import('../auth/createUser')
      const { getUserByEmail } = await import('../auth/permissions')

      await createUser({ email: 'MiXeD@Example.COM', password: 'pw-12345678' })

      expect((await getUserByEmail('mixed@example.com'))?.email).toBe(
        'mixed@example.com'
      )
    })

    it('still rejects a duplicate address', async () => {
      // Uniqueness moves between columns with the mode, so it has to be
      // asserted in both — a UNIQUE on the column nobody writes enforces
      // nothing.
      const { createUser } = await import('../auth/createUser')

      await createUser({ email: 'dupe@example.com', password: 'pw-12345678' })

      await expect(
        createUser({ email: 'dupe@example.com', password: 'pw-12345678' })
      ).rejects.toThrow()
    })

    it('reads the address back through every path that returns a user', async () => {
      const { createUser } = await import('../auth/createUser')
      const { getUserById, getUserByEmail } = await import('../auth/permissions')

      const created = await createUser({
        email: 'paths@example.com',
        password: 'pw-12345678',
      })

      expect(created.email).toBe('paths@example.com')
      expect((await getUserById(created.id))?.email).toBe('paths@example.com')
      expect((await getUserByEmail('paths@example.com'))?.email).toBe(
        'paths@example.com'
      )
    })
  })
}

describe('assertPiiStorageMatchesData', () => {
  it('accepts a fresh install in either mode', async () => {
    const { assertPiiStorageMatchesData } = await import('./piiStorageCheck')

    mode.encryptUserEmail = true
    await expect(assertPiiStorageMatchesData()).resolves.toBeUndefined()

    mode.encryptUserEmail = false
    await expect(assertPiiStorageMatchesData()).resolves.toBeUndefined()
  })

  it('refuses to run against data written the other way', async () => {
    // The whole reason this is an install-time choice. Flipping it strands
    // every existing row, and the symptom is that nobody can sign in — which
    // reads as data loss, not as a config error, unless something says so.
    const { createUser } = await import('../auth/createUser')
    const { assertPiiStorageMatchesData } = await import('./piiStorageCheck')

    mode.encryptUserEmail = true
    await createUser({ email: 'locked@example.com', password: 'pw-12345678' })

    mode.encryptUserEmail = false
    await expect(assertPiiStorageMatchesData()).rejects.toThrow(
      /stored the other way/i
    )
  })
})
