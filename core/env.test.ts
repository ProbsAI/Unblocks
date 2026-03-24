import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

describe('getEnv', () => {
  const validEnv = {
    DATABASE_URL: 'postgres://localhost:5432/test',
    APP_URL: 'http://localhost:3000',
    SESSION_SECRET: 'a'.repeat(32),
  }

  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    vi.resetModules()
    originalEnv = { ...process.env }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  async function loadGetEnv(): Promise<() => unknown> {
    const mod = await import('./env')
    return mod.getEnv
  }

  it('returns valid env when all required vars are set', async () => {
    Object.assign(process.env, validEnv)
    const getEnv = await loadGetEnv()
    const env = getEnv()
    expect(env).toMatchObject({
      DATABASE_URL: validEnv.DATABASE_URL,
      APP_URL: validEnv.APP_URL,
      SESSION_SECRET: validEnv.SESSION_SECRET,
    })
  })

  it('throws on missing DATABASE_URL', async () => {
    Object.assign(process.env, validEnv)
    delete process.env.DATABASE_URL
    const getEnv = await loadGetEnv()
    expect(() => getEnv()).toThrow('Environment variable validation failed')
  })

  it('throws on invalid DATABASE_URL (not a URL)', async () => {
    Object.assign(process.env, { ...validEnv, DATABASE_URL: 'not-a-url' })
    const getEnv = await loadGetEnv()
    expect(() => getEnv()).toThrow('Environment variable validation failed')
  })

  it('throws on missing APP_URL', async () => {
    Object.assign(process.env, validEnv)
    delete process.env.APP_URL
    const getEnv = await loadGetEnv()
    expect(() => getEnv()).toThrow('Environment variable validation failed')
  })

  it('throws on SESSION_SECRET too short', async () => {
    Object.assign(process.env, { ...validEnv, SESSION_SECRET: 'short' })
    const getEnv = await loadGetEnv()
    expect(() => getEnv()).toThrow('Environment variable validation failed')
  })

  it('returns optional fields when present', async () => {
    Object.assign(process.env, {
      ...validEnv,
      REDIS_URL: 'redis://localhost:6379',
      STRIPE_SECRET_KEY: 'sk_test_123',
      STRIPE_PUBLISHABLE_KEY: 'pk_test_123',
      STRIPE_WEBHOOK_SECRET: 'whsec_123',
      RESEND_API_KEY: 're_123',
      GOOGLE_CLIENT_ID: 'google-id',
      GOOGLE_CLIENT_SECRET: 'google-secret',
      UNBLOCKS_LICENSE_KEY: 'license-key',
    })
    const getEnv = await loadGetEnv()
    const env = getEnv()
    expect(env).toMatchObject({
      REDIS_URL: 'redis://localhost:6379',
      STRIPE_SECRET_KEY: 'sk_test_123',
      STRIPE_PUBLISHABLE_KEY: 'pk_test_123',
      STRIPE_WEBHOOK_SECRET: 'whsec_123',
      RESEND_API_KEY: 're_123',
      GOOGLE_CLIENT_ID: 'google-id',
      GOOGLE_CLIENT_SECRET: 'google-secret',
      UNBLOCKS_LICENSE_KEY: 'license-key',
    })
  })

  it('caches env on second call', async () => {
    Object.assign(process.env, validEnv)
    const getEnv = await loadGetEnv()
    const env1 = getEnv()
    const env2 = getEnv()
    expect(env1).toBe(env2) // same reference
  })

  it('error message includes field names', async () => {
    // Remove all required vars
    delete process.env.DATABASE_URL
    delete process.env.APP_URL
    delete process.env.SESSION_SECRET
    const getEnv = await loadGetEnv()
    try {
      getEnv()
      expect.fail('should have thrown')
    } catch (err) {
      const message = (err as Error).message
      expect(message).toContain('DATABASE_URL')
      expect(message).toContain('APP_URL')
      expect(message).toContain('SESSION_SECRET')
    }
  })
})
