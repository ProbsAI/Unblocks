import { describe, it, expect, beforeAll } from 'vitest'
import { createToken, verifyToken, generateRandomToken } from './token'
import type { TokenPayload } from './token'

// Set SESSION_SECRET for token signing/verification
beforeAll(() => {
  process.env.SESSION_SECRET = 'test-secret-that-is-long-enough-for-hmac-256'
})

describe('createToken', () => {
  it('creates a JWT string', async () => {
    const payload: TokenPayload = {
      userId: 'user-123',
      sessionId: 'session-456',
      type: 'session',
    }

    const token = await createToken(payload)

    expect(typeof token).toBe('string')
    // JWT has 3 parts separated by dots
    expect(token.split('.')).toHaveLength(3)
  })

  it('creates different tokens for different payloads', async () => {
    const token1 = await createToken({
      userId: 'user-1',
      sessionId: 'session-1',
      type: 'session',
    })

    const token2 = await createToken({
      userId: 'user-2',
      sessionId: 'session-2',
      type: 'session',
    })

    expect(token1).not.toBe(token2)
  })
})

describe('verifyToken', () => {
  it('verifies a valid token and returns the payload', async () => {
    const payload: TokenPayload = {
      userId: 'user-123',
      sessionId: 'session-456',
      type: 'session',
    }

    const token = await createToken(payload, '1h')
    const result = await verifyToken(token)

    expect(result).not.toBeNull()
    expect(result!.userId).toBe('user-123')
    expect(result!.sessionId).toBe('session-456')
    expect(result!.type).toBe('session')
  })

  it('returns null for an invalid token', async () => {
    const result = await verifyToken('invalid.token.string')
    expect(result).toBeNull()
  })

  it('returns null for a tampered token', async () => {
    const token = await createToken({
      userId: 'user-123',
      sessionId: 'session-456',
      type: 'session',
    })

    // Tamper with the token by changing a character in the signature
    const parts = token.split('.')
    parts[2] = parts[2].slice(0, -1) + (parts[2].slice(-1) === 'a' ? 'b' : 'a')
    const tampered = parts.join('.')

    const result = await verifyToken(tampered)
    expect(result).toBeNull()
  })

  it('returns null for an empty string', async () => {
    const result = await verifyToken('')
    expect(result).toBeNull()
  })

  it('preserves token type field', async () => {
    const types: TokenPayload['type'][] = [
      'session',
      'email_verification',
      'password_reset',
      'magic_link',
    ]

    for (const type of types) {
      const token = await createToken({
        userId: 'user-1',
        sessionId: 'session-1',
        type,
      })

      const result = await verifyToken(token)
      expect(result).not.toBeNull()
      expect(result!.type).toBe(type)
    }
  })
})

describe('generateRandomToken', () => {
  it('generates a hex string', () => {
    const token = generateRandomToken()
    expect(token).toMatch(/^[0-9a-f]+$/)
  })

  it('generates a 64-character hex string (32 bytes)', () => {
    const token = generateRandomToken()
    expect(token).toHaveLength(64)
  })

  it('generates unique tokens', () => {
    const tokens = new Set(Array.from({ length: 10 }, () => generateRandomToken()))
    expect(tokens.size).toBe(10)
  })
})
