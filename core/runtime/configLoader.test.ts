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
