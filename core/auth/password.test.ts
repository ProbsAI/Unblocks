import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword } from './password'

describe('hashPassword', () => {
  it('returns a bcrypt hash string', async () => {
    const hash = await hashPassword('mypassword')

    // bcrypt hashes start with $2a$ or $2b$
    expect(hash).toMatch(/^\$2[ab]\$/)
  })

  it('produces different hashes for the same password (due to salt)', async () => {
    const hash1 = await hashPassword('samepassword')
    const hash2 = await hashPassword('samepassword')

    expect(hash1).not.toBe(hash2)
  })

  it('produces a hash that is not the original password', async () => {
    const password = 'supersecret'
    const hash = await hashPassword(password)

    expect(hash).not.toBe(password)
    expect(hash.length).toBeGreaterThan(password.length)
  })
})

describe('verifyPassword', () => {
  it('returns true for correct password', async () => {
    const password = 'correctpassword'
    const hash = await hashPassword(password)

    const result = await verifyPassword(password, hash)
    expect(result).toBe(true)
  })

  it('returns false for incorrect password', async () => {
    const hash = await hashPassword('rightpassword')

    const result = await verifyPassword('wrongpassword', hash)
    expect(result).toBe(false)
  })

  it('handles empty password', async () => {
    const hash = await hashPassword('')

    expect(await verifyPassword('', hash)).toBe(true)
    expect(await verifyPassword('notempty', hash)).toBe(false)
  })

  it('handles passwords with special characters', async () => {
    const password = 'p@$$w0rd!#%^&*()_+-=[]{}|;:,.<>?'
    const hash = await hashPassword(password)

    expect(await verifyPassword(password, hash)).toBe(true)
  })

  it('handles long passwords', async () => {
    const password = 'a'.repeat(100)
    const hash = await hashPassword(password)

    expect(await verifyPassword(password, hash)).toBe(true)
    expect(await verifyPassword('a'.repeat(99), hash)).toBe(false)
  })
})
