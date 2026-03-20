import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

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

/**
 * Encrypts a plaintext string using AES-256-GCM.
 *
 * Output format: `<keyIndex>:<iv>:<authTag>:<ciphertext>` (all hex-encoded).
 * keyIndex=0 means the primary (current) key.
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

  return `0:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`
}

/**
 * Decrypts a ciphertext string produced by encrypt().
 * Supports key rotation: tries all keys if the key index indicates
 * an older key, or falls back to trying all keys.
 */
export function decrypt(ciphertext: string): string {
  const parts = ciphertext.split(':')
  if (parts.length !== 4) {
    throw new Error('Invalid encrypted value format')
  }

  const [keyIndexStr, ivHex, authTagHex, encryptedHex] = parts
  const keyIndex = parseInt(keyIndexStr, 10)
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const encrypted = Buffer.from(encryptedHex, 'hex')

  const keys = getEncryptionKeys()

  // Try the indicated key first, then fall back to all keys
  const keysToTry =
    keyIndex < keys.length
      ? [keys[keyIndex], ...keys.filter((_, i) => i !== keyIndex)]
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
