import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16
const KEY_LENGTH = 32

/**
 * Parses encryption keys from the ENCRYPTION_KEY env var.
 * Supports key rotation: comma-separated keys, newest first.
 * Each key must be a 64-char hex string (32 bytes).
 */
function getEncryptionKeys(): Buffer[] {
  const raw = process.env.ENCRYPTION_KEY
  if (!raw) {
    throw new Error(
      'ENCRYPTION_KEY is required. Generate with: openssl rand -hex 32'
    )
  }

  const keys = raw.split(',').map((k) => k.trim())
  const buffers: Buffer[] = []

  for (const key of keys) {
    if (key.length !== KEY_LENGTH * 2) {
      throw new Error(
        `Each ENCRYPTION_KEY must be ${KEY_LENGTH * 2} hex chars (${KEY_LENGTH} bytes). Got ${key.length} chars.`
      )
    }
    buffers.push(Buffer.from(key, 'hex'))
  }

  return buffers
}

/** Returns the primary (newest) encryption key for encrypting new data. */
function getPrimaryKey(): Buffer {
  return getEncryptionKeys()[0]
}

/** Derives a stable 8-char fingerprint from a key (first 8 hex chars of SHA-256). */
function keyFingerprint(key: Buffer): string {
  return createHash('sha256').update(key).digest('hex').slice(0, 8)
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 *
 * Output format: `<keyId>:<iv>:<authTag>:<ciphertext>` (all hex-encoded).
 * keyId is a stable fingerprint (SHA-256 prefix) of the encryption key,
 * so it remains valid even after key rotation reorders the key list.
 */
export function encrypt(plaintext: string): string {
  const key = getPrimaryKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  })

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()

  return `${keyFingerprint(key)}:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`
}

/**
 * Decrypts a ciphertext string produced by encrypt().
 * Supports key rotation: matches the key by fingerprint first,
 * then falls back to trying all keys (handles legacy numeric index format).
 */
export function decrypt(ciphertext: string): string {
  const parts = ciphertext.split(':')
  if (parts.length !== 4) {
    throw new Error('Invalid encrypted value format')
  }

  const [keyId, ivHex, authTagHex, encryptedHex] = parts
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const encrypted = Buffer.from(encryptedHex, 'hex')

  const keys = getEncryptionKeys()

  // Match by fingerprint first, then fall back to all keys
  const matchedKey = keys.find((k) => keyFingerprint(k) === keyId)
  const keysToTry = matchedKey
    ? [matchedKey, ...keys.filter((k) => k !== matchedKey)]
    : keys

  for (const key of keysToTry) {
    try {
      const decipher = createDecipheriv(ALGORITHM, key, iv, {
        authTagLength: AUTH_TAG_LENGTH,
      })
      decipher.setAuthTag(authTag)
      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
      ])
      return decrypted.toString('utf8')
    } catch {
      // Wrong key — try next
      continue
    }
  }

  throw new Error('Decryption failed: no valid key found')
}

/**
 * Encrypts a value, returning null if the input is null/undefined.
 * Convenience wrapper for nullable database columns.
 */
export function encryptNullable(value: string | null | undefined): string | null {
  if (value == null) return null
  return encrypt(value)
}

/**
 * Decrypts a value, returning null if the input is null/undefined.
 * Convenience wrapper for nullable database columns.
 */
export function decryptNullable(value: string | null | undefined): string | null {
  if (value == null) return null
  return decrypt(value)
}
