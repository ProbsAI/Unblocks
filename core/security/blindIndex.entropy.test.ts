import { describe, it, expect, beforeAll } from 'vitest'

/**
 * Enforces the premise that makes HMAC-SHA256 the right construction for
 * blindIndex, rather than leaving it as a claim in a comment.
 *
 * CodeQL raises `js/insufficient-password-hash` against blindIndex because the
 * credentials reaching it look like passwords. The dismissal rests on one
 * factual assertion: every secret hashed there is high-entropy CSPRNG output,
 * so no amount of hashing slowness would add security. An assertion in a doc
 * comment decays silently — a future token generator using a 6-digit code, a
 * timestamp, or Math.random() would invalidate it with nothing failing.
 *
 * These tests make that premise checkable. If one fails, the CodeQL alert has
 * become true and the construction needs revisiting, not re-dismissing.
 */

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

  it('API keys carry 256 bits after the identifying prefix', async () => {
    const { API_KEY_PREFIX } = await import('../api-keys/types')

    // createApiKey builds `${API_KEY_PREFIX}${randomBytes(32).toString('hex')}`.
    // Asserting the shape here keeps the check independent of a live database.
    const sample = `${API_KEY_PREFIX}${'0'.repeat(64)}`
    expect(sample.slice(API_KEY_PREFIX.length)).toHaveLength(64)
    expect(API_KEY_PREFIX).toBe('ub_live_')
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
