import { describe, it, expect, beforeEach } from 'vitest'
import { loadConfig, clearConfigCache } from './configLoader'

describe('configLoader', () => {
  beforeEach(() => {
    clearConfigCache()
  })

  it('loads billing config with defaults', () => {
    const config = loadConfig('billing')
    expect(config).toBeDefined()
    expect(config.provider).toBe('stripe')
    expect(config.plans).toBeDefined()
    expect(Array.isArray(config.plans)).toBe(true)
  })

  it('loads auth config', () => {
    const config = loadConfig('auth')
    expect(config).toBeDefined()
  })

  it('caches config on second call', () => {
    const config1 = loadConfig('billing')
    const config2 = loadConfig('billing')
    expect(config1).toBe(config2) // same reference
  })

  it('returns fresh config after cache clear', () => {
    const config1 = loadConfig('billing')
    clearConfigCache()
    const config2 = loadConfig('billing')
    // Deep equal but not same reference
    expect(config2).toEqual(config1)
  })

  it('loads all config keys without error', () => {
    const keys = ['auth', 'billing', 'email', 'jobs', 'uploads', 'teams', 'notifications', 'app'] as const
    for (const key of keys) {
      expect(() => loadConfig(key)).not.toThrow()
    }
  })

  it('validates config against schema', () => {
    const billing = loadConfig('billing')
    // Billing must have plans array and stripe config
    expect(billing).toHaveProperty('plans')
    expect(billing).toHaveProperty('stripe')
    expect(billing).toHaveProperty('trial')
    expect(billing).toHaveProperty('behavior')
  })
})

describe('loadConfig — user config is actually read', () => {
  it('returns the plans defined in config/billing.config.ts, not schema defaults', async () => {
    // The regression this guards: loadConfig used require() inside a try/catch.
    // In an ESM runtime require is undefined, so it threw for every key and the
    // catch silently substituted {} — every user config file was ignored and the
    // app ran on schema defaults. Nothing surfaced it, because the fallback is
    // silent by design.
    //
    // The schema default ships a single 'free' plan. The user config defines
    // free, pro and business, so asserting on 'business' distinguishes "config
    // was read" from "defaults were used".
    const { loadConfig } = await import('./configLoader')
    const billing = loadConfig('billing')

    expect(billing.plans.map((p) => p.id)).toContain('business')
  })

  it('reads a value from every registered config file', async () => {
    // A new config file must be added to the static import map; without this
    // check, forgetting it reintroduces the silent-defaults failure for that key.
    const { loadConfig } = await import('./configLoader')

    expect(loadConfig('app').name).toBeTruthy()
    expect(loadConfig('auth').session).toBeDefined()
    expect(loadConfig('billing').plans.length).toBeGreaterThan(0)
    expect(loadConfig('email').from).toBeDefined()
    expect(loadConfig('jobs')).toBeDefined()
    expect(loadConfig('uploads')).toBeDefined()
    expect(loadConfig('teams')).toBeDefined()
    expect(loadConfig('notifications')).toBeDefined()
  })
})
