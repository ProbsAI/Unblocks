import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { blindIndex, blindIndexNullable } from './blindIndex'

const TEST_KEY = 'a'.repeat(64)

describe('blindIndex', () => {
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY
  })

  afterEach(() => {
    delete process.env.ENCRYPTION_KEY
  })

  it('produces a deterministic hash', () => {
    const hash1 = blindIndex('test@example.com')
    const hash2 = blindIndex('test@example.com')

    expect(hash1).toBe(hash2)
  })

  it('returns a 64-char hex string (SHA-256)', () => {
    const hash = blindIndex('any input')

    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('produces different hashes for different inputs', () => {
    const hash1 = blindIndex('user1@example.com')
    const hash2 = blindIndex('user2@example.com')

    expect(hash1).not.toBe(hash2)
  })

  it('is case-insensitive (lowercases input)', () => {
    const hash1 = blindIndex('TEST@EXAMPLE.COM')
    const hash2 = blindIndex('test@example.com')

    expect(hash1).toBe(hash2)
  })

  it('produces different hashes with different keys', () => {
    const hash1 = blindIndex('test@example.com')

    process.env.ENCRYPTION_KEY = 'b'.repeat(64)
    const hash2 = blindIndex('test@example.com')

    expect(hash1).not.toBe(hash2)
  })

  it('handles empty string', () => {
    const hash = blindIndex('')

    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('handles unicode characters', () => {
    const hash = blindIndex('ユーザー@例.jp')

    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('blindIndexNullable', () => {
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY
  })

  afterEach(() => {
    delete process.env.ENCRYPTION_KEY
  })

  it('returns null for null input', () => {
    expect(blindIndexNullable(null)).toBeNull()
  })

  it('returns null for undefined input', () => {
    expect(blindIndexNullable(undefined)).toBeNull()
  })

  it('returns hash for non-null value', () => {
    const hash = blindIndexNullable('test@example.com')

    expect(hash).not.toBeNull()
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('missing ENCRYPTION_KEY', () => {
  beforeEach(() => {
    delete process.env.ENCRYPTION_KEY
  })

  it('throws when ENCRYPTION_KEY is not set', () => {
    expect(() => blindIndex('test')).toThrow('ENCRYPTION_KEY is required')
  })
})
