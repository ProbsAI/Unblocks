import { describe, it, expect, beforeAll, vi } from 'vitest'

/**
 * Enforces the premise that lets blindIndex run a deliberately low work factor.
 *
 * blindIndex is PBKDF2 at 1000 iterations, which is nowhere near enough for a
 * password. That is fine only because every secret reaching it is high-entropy
 * CSPRNG output or a signed JWT, so guessing is infeasible regardless of speed
 * — the work factor is not what protects those values, their size is.
 *
 * An assertion like that decays silently. A future token generator using a
 * 6-digit code, a timestamp, or Math.random() would invalidate it with nothing
 * failing, and the fast derivation would quietly become a real weakness of the
 * kind `js/insufficient-password-hash` exists to catch.
 *
 * These tests make the premise checkable. If one fails, do not raise the
 * iteration count to paper over it — find out what low-entropy value started
 * flowing in, and give it its own derivation with a real work factor — or
 * route it to bcrypt.
 */

/**
 * Only the database is faked, so createApiKey's real key generation runs. The
 * point of the API-key case below is to exercise the generator itself; stubbing
 * it out would leave exactly the hole this suite exists to close.
 */
vi.mock('../db/client', () => ({
  getDb: () => ({
    insert: () => ({
      values: (values: Record<string, unknown>) => ({
        returning: async () => [
          {
            id: 'key-row',
            lastUsedAt: null,
            revokedAt: null,
            createdAt: new Date(),
            teamId: null,
            ...values,
          },
        ],
      }),
    }),
  }),
}))

beforeAll(() => {
  process.env.ENCRYPTION_KEY = 'a'.repeat(64)
  process.env.BLIND_INDEX_KEY = 'b'.repeat(64)
  process.env.SESSION_SECRET = 'test-secret-key-at-least-32-characters-long'
})

/** 32 bytes rendered as hex — 256 bits of entropy. */
const CSPRNG_HEX_256 = /^[0-9a-f]{64}$/

describe('secrets reaching blindIndex are high-entropy', () => {
  it('generateRandomToken yields 256 bits (magic link, password reset, email verification)', async () => {
    const { generateRandomToken } = await import('../auth/token')

    const token = generateRandomToken()
    expect(token).toMatch(CSPRNG_HEX_256)
  })

  it('generateRandomToken does not repeat across calls', async () => {
    const { generateRandomToken } = await import('../auth/token')

    const seen = new Set(Array.from({ length: 200 }, () => generateRandomToken()))
    expect(seen.size).toBe(200)
  })

  it('createApiKey emits 256 bits after the identifying prefix', async () => {
    const { createApiKey } = await import('../api-keys/create')
    const { API_KEY_PREFIX } = await import('../api-keys/types')

    // The real generator, not a fabricated sample. An earlier version of this
    // test asserted the shape of a hand-written string, which would have stayed
    // green if createApiKey started returning a constant or a counter — the one
    // change that would actually invalidate the CodeQL dismissal.
    const keys = await Promise.all(
      Array.from({ length: 50 }, async (_unused, i) => {
        const { key } = await createApiKey('user-1', { name: `key-${i}` })
        return key
      })
    )

    expect(API_KEY_PREFIX).toBe('ub_live_')
    for (const key of keys) {
      expect(key.startsWith(API_KEY_PREFIX)).toBe(true)
      expect(key.slice(API_KEY_PREFIX.length)).toMatch(CSPRNG_HEX_256)
    }

    // Independent draws. A fixed, seeded or counter-based generator collides
    // here; 50 draws from 2^256 do not.
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('the OAuth state token is 256 bits', async () => {
    const { generateCsrfToken } = await import('./csrf')

    expect(generateCsrfToken()).toMatch(CSPRNG_HEX_256)
  })
})

describe('blindIndex behaviour the lookup path depends on', () => {
  it('is deterministic, which a salted KDF could not be', async () => {
    const { blindIndex } = await import('./blindIndex')

    // This is the functional reason bcrypt/argon2 cannot be substituted:
    // WHERE hash = ? requires the same input to produce the same output.
    expect(blindIndex('ub_live_abc')).toBe(blindIndex('ub_live_abc'))
  })

  it('produces different digests for different inputs', async () => {
    const { blindIndex } = await import('./blindIndex')

    expect(blindIndex('token-a')).not.toBe(blindIndex('token-b'))
  })

  it('is keyed — a different key yields a different digest for the same input', async () => {
    // The keying is why an attacker holding only the database cannot compute
    // candidate digests, which is the property an unkeyed password hash lacks.
    // getHmacKey reads BLIND_INDEX_KEY on every call, so swapping the env var
    // is enough — no module reload needed.
    const { blindIndex } = await import('./blindIndex')

    const withFirstKey = blindIndex('same-input')

    process.env.BLIND_INDEX_KEY = 'c'.repeat(64)
    const withSecondKey = blindIndex('same-input')
    process.env.BLIND_INDEX_KEY = 'b'.repeat(64)

    expect(withSecondKey).not.toBe(withFirstKey)
    expect(blindIndex('same-input')).toBe(withFirstKey)
  })
})

describe('user passwords do not use blindIndex', () => {
  it('hashPassword uses bcrypt, which is salted and slow by design', async () => {
    const { hashPassword, verifyPassword } = await import('../auth/password')

    const hash = await hashPassword('correct horse battery staple')

    // bcrypt digests carry their algorithm and cost in the prefix. This is the
    // separation the CodeQL dismissal depends on: guessable secrets go here,
    // high-entropy tokens go to blindIndex.
    expect(hash).toMatch(/^\$2[aby]\$\d{2}\$/)
    expect(hash).not.toMatch(CSPRNG_HEX_256)

    expect(await verifyPassword('correct horse battery staple', hash)).toBe(true)
    expect(await verifyPassword('wrong', hash)).toBe(false)
  })

  it('bcrypt salts, so the same password hashes differently each time', async () => {
    const { hashPassword } = await import('../auth/password')

    const [a, b] = await Promise.all([
      hashPassword('same-password'),
      hashPassword('same-password'),
    ])

    expect(a).not.toBe(b)
  })
})

describe('the hot path stays fast', () => {
  it('session and API key lookups use the one cheap derivation', async () => {
    // validateSession runs on every authenticated request and validateApiKey on
    // every API call, so both go through the one cheap derivation. There is no
    // high-work-factor variant to route them to by mistake any more — the one
    // that existed hashed a column nothing ever read.
    const [sessionSrc, apiKeySrc] = await Promise.all([
      import('node:fs/promises').then((fs) =>
        fs.readFile('core/auth/validateSession.ts', 'utf8')
      ),
      import('node:fs/promises').then((fs) =>
        fs.readFile('core/api-keys/validate.ts', 'utf8')
      ),
    ])

    expect(sessionSrc).toContain('blindIndex(')
    expect(apiKeySrc).toContain('blindIndex(')
  })
})
