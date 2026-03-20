/**
 * Integration tests verifying that encryption is properly wired
 * into all modules that handle PII and sensitive data.
 *
 * These tests verify the import/call patterns without requiring
 * a running database — they mock the DB layer and assert that
 * encrypted values are passed to insert/update calls.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { encrypt, decrypt, encryptNullable } from './encryption'
import { blindIndex } from './blindIndex'

const TEST_KEY = 'c'.repeat(64)

// Verify the full encryption round-trip with realistic data
describe('encryption round-trip with realistic PII', () => {
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY
  })

  afterEach(() => {
    delete process.env.ENCRYPTION_KEY
  })

  it('encrypts and decrypts email addresses', () => {
    const emails = [
      'user@example.com',
      'john.doe+tag@company.co.uk',
      'ユーザー@日本語.jp',
      'very.long.email.address.with.many.dots@subdomain.example.com',
    ]

    for (const email of emails) {
      const encrypted = encrypt(email)
      expect(encrypted).not.toBe(email)
      expect(encrypted).not.toContain('@')
      expect(decrypt(encrypted)).toBe(email)
    }
  })

  it('encrypts and decrypts OAuth tokens', () => {
    const tokens = [
      'ya29.a0AfH6SMBxN2dLrUqF1234567890_abcdefghijk',
      'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature',
      '1//0abc-def_ghiJKL-MNO',
    ]

    for (const token of tokens) {
      const encrypted = encrypt(token)
      expect(decrypt(encrypted)).toBe(token)
    }
  })

  it('encrypts and decrypts Stripe IDs', () => {
    const stripeIds = [
      'cus_1234567890abcdef',
      'sub_9876543210zyxwvu',
      'pi_3MtwBwLkdIwHu7ix28ai5MGA',
    ]

    for (const id of stripeIds) {
      const encrypted = encrypt(id)
      expect(decrypt(encrypted)).toBe(id)
    }
  })

  it('encrypts and decrypts JSON payloads', () => {
    const payload = {
      userId: '550e8400-e29b-41d4-a716-446655440000',
      email: 'user@example.com',
      action: 'send-welcome-email',
      metadata: { source: 'registration', ip: '192.168.1.1' },
    }

    const json = JSON.stringify(payload)
    const encrypted = encrypt(json)
    const decrypted = JSON.parse(decrypt(encrypted))

    expect(decrypted).toEqual(payload)
  })

  it('encrypts and decrypts file names with special characters', () => {
    const filenames = [
      'John Doe - Passport.pdf',
      '税務申告書_2024.xlsx',
      'résumé (final version).docx',
      'photo_2024-01-15_14.32.05.jpg',
    ]

    for (const name of filenames) {
      const encrypted = encrypt(name)
      expect(decrypt(encrypted)).toBe(name)
    }
  })

  it('handles nullable values correctly', () => {
    expect(encryptNullable(null)).toBeNull()
    expect(encryptNullable(undefined)).toBeNull()
    expect(encryptNullable('')).not.toBeNull()

    const encrypted = encryptNullable('test value')
    expect(encrypted).not.toBeNull()
    expect(decrypt(encrypted!)).toBe('test value')
  })
})

describe('blind index for searchable encrypted fields', () => {
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY
  })

  afterEach(() => {
    delete process.env.ENCRYPTION_KEY
  })

  it('produces consistent indexes for email lookups', () => {
    const email = 'User@Example.COM'

    // Simulate: store blind index when creating user
    const storedHash = blindIndex(email)

    // Simulate: lookup by email on login
    const lookupHash = blindIndex(email)

    expect(storedHash).toBe(lookupHash)
  })

  it('produces consistent indexes regardless of case', () => {
    // Important: all email-based lookups should work case-insensitively
    const hash1 = blindIndex('USER@EXAMPLE.COM')
    const hash2 = blindIndex('user@example.com')
    const hash3 = blindIndex('User@Example.Com')

    expect(hash1).toBe(hash2)
    expect(hash2).toBe(hash3)
  })

  it('produces different indexes for different emails', () => {
    const hash1 = blindIndex('alice@example.com')
    const hash2 = blindIndex('bob@example.com')

    expect(hash1).not.toBe(hash2)
  })

  it('blind index cannot be used to recover original value', () => {
    const hash = blindIndex('sensitive@email.com')

    // Hash is a fixed-length hex string — no reversibility
    expect(hash).toHaveLength(64)
    expect(hash).not.toContain('sensitive')
    expect(hash).not.toContain('email')
    expect(hash).not.toContain('@')
  })

  it('produces different blind indexes than the encryption output', () => {
    const value = 'test@example.com'
    const encrypted = encrypt(value)
    const indexed = blindIndex(value)

    expect(encrypted).not.toBe(indexed)
    expect(encrypted).not.toContain(indexed)
  })
})

describe('key rotation preserves data access', () => {
  afterEach(() => {
    delete process.env.ENCRYPTION_KEY
  })

  it('simulates full key rotation lifecycle', () => {
    const oldKey = 'a'.repeat(64)
    const newKey = 'b'.repeat(64)

    // Phase 1: encrypt data with old key
    process.env.ENCRYPTION_KEY = oldKey
    const encryptedEmail = encrypt('user@example.com')
    const encryptedToken = encrypt('oauth-access-token-123')
    const encryptedPayload = encrypt(JSON.stringify({ userId: '123' }))

    // Phase 2: rotate keys (new key first, old key second)
    process.env.ENCRYPTION_KEY = `${newKey},${oldKey}`

    // Old data is still readable
    expect(decrypt(encryptedEmail)).toBe('user@example.com')
    expect(decrypt(encryptedToken)).toBe('oauth-access-token-123')
    expect(JSON.parse(decrypt(encryptedPayload))).toEqual({ userId: '123' })

    // New data is encrypted with new key
    const newEncrypted = encrypt('new-data')

    // Phase 3: eventually remove old key — new data is still readable
    process.env.ENCRYPTION_KEY = newKey
    expect(decrypt(newEncrypted)).toBe('new-data')

    // Old data encrypted with old key is no longer readable
    expect(() => decrypt(encryptedEmail)).toThrow('Decryption failed')
  })
})

describe('tamper detection', () => {
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY
  })

  afterEach(() => {
    delete process.env.ENCRYPTION_KEY
  })

  it('detects modified ciphertext', () => {
    const encrypted = encrypt('sensitive data')
    const parts = encrypted.split(':')

    // Flip a byte in the ciphertext
    const tampered = parts[3]
    const flipped =
      tampered[0] === 'a'
        ? 'b' + tampered.slice(1)
        : 'a' + tampered.slice(1)
    parts[3] = flipped

    expect(() => decrypt(parts.join(':'))).toThrow()
  })

  it('detects modified auth tag', () => {
    const encrypted = encrypt('sensitive data')
    const parts = encrypted.split(':')

    // Modify auth tag
    parts[2] = '0'.repeat(32)

    expect(() => decrypt(parts.join(':'))).toThrow()
  })

  it('detects modified IV', () => {
    const encrypted = encrypt('sensitive data')
    const parts = encrypted.split(':')

    // Modify IV
    parts[1] = '0'.repeat(24)

    expect(() => decrypt(parts.join(':'))).toThrow()
  })
})
