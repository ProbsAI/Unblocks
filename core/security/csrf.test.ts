import { describe, it, expect } from 'vitest'
import { generateCsrfToken, validateCsrfToken } from './csrf'

describe('generateCsrfToken', () => {
  it('generates a hex string', () => {
    const token = generateCsrfToken()
    expect(token).toMatch(/^[0-9a-f]+$/)
  })

  it('generates a 64-character hex string (32 bytes)', () => {
    const token = generateCsrfToken()
    expect(token).toHaveLength(64)
  })

  it('generates unique tokens on each call', () => {
    const token1 = generateCsrfToken()
    const token2 = generateCsrfToken()
    const token3 = generateCsrfToken()

    expect(token1).not.toBe(token2)
    expect(token2).not.toBe(token3)
    expect(token1).not.toBe(token3)
  })
})

describe('validateCsrfToken', () => {
  it('returns true when cookie and header tokens match', () => {
    const token = generateCsrfToken()
    expect(validateCsrfToken(token, token)).toBe(true)
  })

  it('returns false when tokens do not match', () => {
    const token1 = generateCsrfToken()
    const token2 = generateCsrfToken()
    expect(validateCsrfToken(token1, token2)).toBe(false)
  })

  it('returns false when cookie token is undefined', () => {
    expect(validateCsrfToken(undefined, 'some-token')).toBe(false)
  })

  it('returns false when header token is undefined', () => {
    expect(validateCsrfToken('some-token', undefined)).toBe(false)
  })

  it('returns false when both tokens are undefined', () => {
    expect(validateCsrfToken(undefined, undefined)).toBe(false)
  })

  it('returns false for empty strings', () => {
    // Empty string is falsy, so validation should fail
    expect(validateCsrfToken('', '')).toBe(false)
  })
})
