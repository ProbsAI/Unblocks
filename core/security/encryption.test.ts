import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { encrypt, decrypt, encryptNullable, decryptNullable } from './encryption'

const TEST_KEY = 'a'.repeat(64) // 64 hex chars = 32 bytes
const TEST_KEY_2 = 'b'.repeat(64)

describe('encrypt', () => {
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY
  })

  afterEach(() => {
    delete process.env.ENCRYPTION_KEY
  })

  it('encrypts and decrypts a string correctly', () => {
    const plaintext = 'hello@example.com'
    const ciphertext = encrypt(plaintext)
    const decrypted = decrypt(ciphertext)

    expect(decrypted).toBe(plaintext)
  })

  it('produces different ciphertext each time (random IV)', () => {
    const plaintext = 'same input'
    const ct1 = encrypt(plaintext)
    const ct2 = encrypt(plaintext)

    expect(ct1).not.toBe(ct2)
    expect(decrypt(ct1)).toBe(plaintext)
    expect(decrypt(ct2)).toBe(plaintext)
  })

  it('output format is keyFingerprint:iv:authTag:ciphertext', () => {
    const ciphertext = encrypt('test')
    const parts = ciphertext.split(':')

    expect(parts).toHaveLength(4)
    expect(parts[0]).toHaveLength(8) // 8-char key fingerprint
    expect(parts[1]).toHaveLength(24) // 12 bytes IV = 24 hex chars
    expect(parts[2]).toHaveLength(32) // 16 bytes auth tag = 32 hex chars
    expect(parts[3].length).toBeGreaterThan(0) // encrypted data
  })

  it('handles empty string', () => {
    const ciphertext = encrypt('')
    expect(decrypt(ciphertext)).toBe('')
  })

  it('handles unicode characters', () => {
    const plaintext = 'こんにちは 🔒 encrypted'
    const ciphertext = encrypt(plaintext)
    expect(decrypt(ciphertext)).toBe(plaintext)
  })

  it('handles long strings', () => {
    const plaintext = 'x'.repeat(10000)
    const ciphertext = encrypt(plaintext)
    expect(decrypt(ciphertext)).toBe(plaintext)
  })
})

describe('decrypt', () => {
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY
  })

  afterEach(() => {
    delete process.env.ENCRYPTION_KEY
  })

  it('throws on invalid format', () => {
    expect(() => decrypt('not-valid')).toThrow('Invalid encrypted value format')
  })

  it('throws on tampered ciphertext', () => {
    const ciphertext = encrypt('test')
    const parts = ciphertext.split(':')
    parts[3] = 'ff' + parts[3].slice(2) // tamper encrypted data
    expect(() => decrypt(parts.join(':'))).toThrow('Decryption failed')
  })

  it('throws on wrong key', () => {
    const ciphertext = encrypt('test')
    process.env.ENCRYPTION_KEY = TEST_KEY_2
    expect(() => decrypt(ciphertext)).toThrow('Decryption failed')
  })
})

describe('key rotation', () => {
  afterEach(() => {
    delete process.env.ENCRYPTION_KEY
  })

  it('decrypts old data after key rotation', () => {
    // Encrypt with old key
    process.env.ENCRYPTION_KEY = TEST_KEY
    const ciphertext = encrypt('secret data')

    // Rotate: new key first, old key second
    process.env.ENCRYPTION_KEY = `${TEST_KEY_2},${TEST_KEY}`
    const decrypted = decrypt(ciphertext)

    expect(decrypted).toBe('secret data')
  })

  it('encrypts with new key after rotation', () => {
    process.env.ENCRYPTION_KEY = `${TEST_KEY_2},${TEST_KEY}`

    const ciphertext = encrypt('new data')
    const parts = ciphertext.split(':')
    expect(parts[0]).toHaveLength(8) // key fingerprint

    // Should be decryptable with just the new key
    process.env.ENCRYPTION_KEY = TEST_KEY_2
    expect(decrypt(ciphertext)).toBe('new data')
  })
})

describe('encryptNullable / decryptNullable', () => {
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY
  })

  afterEach(() => {
    delete process.env.ENCRYPTION_KEY
  })

  it('returns null for null input', () => {
    expect(encryptNullable(null)).toBeNull()
    expect(decryptNullable(null)).toBeNull()
  })

  it('returns null for undefined input', () => {
    expect(encryptNullable(undefined)).toBeNull()
    expect(decryptNullable(undefined)).toBeNull()
  })

  it('encrypts and decrypts non-null value', () => {
    const encrypted = encryptNullable('hello')
    expect(encrypted).not.toBeNull()
    expect(decryptNullable(encrypted)).toBe('hello')
  })
})

describe('missing ENCRYPTION_KEY', () => {
  beforeEach(() => {
    delete process.env.ENCRYPTION_KEY
  })

  it('throws when ENCRYPTION_KEY is not set', () => {
    expect(() => encrypt('test')).toThrow('ENCRYPTION_KEY is required')
  })
})

describe('invalid ENCRYPTION_KEY', () => {
  afterEach(() => {
    delete process.env.ENCRYPTION_KEY
  })

  it('throws for wrong key length', () => {
    process.env.ENCRYPTION_KEY = 'tooshort'
    expect(() => encrypt('test')).toThrow('64 hex chars')
  })
})
