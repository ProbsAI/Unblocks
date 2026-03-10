import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  validateLicense,
  hasFeature,
  getLicenseTier,
  resetLicenseCache,
} from './licenseValidator'

describe('validateLicense', () => {
  beforeEach(() => {
    resetLicenseCache()
    vi.stubEnv('UNBLOCKS_LICENSE_KEY', '')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns community tier when no key is provided', () => {
    const info = validateLicense()
    expect(info).toEqual({
      valid: false,
      tier: 'community',
      features: [],
      expiresAt: null,
    })
  })

  it('parses builder key prefix', () => {
    const info = validateLicense('ub_builder_abc123')
    expect(info.valid).toBe(true)
    expect(info.tier).toBe('builder')
    expect(info.features).toContain('attribution.remove')
  })

  it('parses pro key prefix', () => {
    const info = validateLicense('ub_pro_abc123')
    expect(info.valid).toBe(true)
    expect(info.tier).toBe('pro')
    expect(info.features).toContain('uploads.s3')
  })

  it('parses team key prefix', () => {
    const info = validateLicense('ub_team_abc123')
    expect(info.tier).toBe('team')
    expect(info.features).toContain('team.seats')
  })

  it('parses enterprise key prefix', () => {
    const info = validateLicense('ub_ent_abc123')
    expect(info.tier).toBe('enterprise')
    expect(info.features).toContain('sso')
  })

  it('returns invalid for unrecognized key prefix', () => {
    const info = validateLicense('invalid_key_format')
    expect(info.valid).toBe(false)
    expect(info.tier).toBe('community')
  })

  it('reads UNBLOCKS_LICENSE_KEY from env when no key argument is passed', () => {
    vi.stubEnv('UNBLOCKS_LICENSE_KEY', 'ub_pro_env_key')
    const info = validateLicense()
    expect(info.tier).toBe('pro')
  })

  it('caches result for same key', () => {
    const first = validateLicense('ub_pro_abc')
    const second = validateLicense('ub_pro_abc')
    expect(first).toBe(second)
  })

  it('returns fresh result when called with a different key', () => {
    const pro = validateLicense('ub_pro_abc')
    expect(pro.tier).toBe('pro')

    const team = validateLicense('ub_team_xyz')
    expect(team.tier).toBe('team')
  })

  it('does not return stale cache after key rotation', () => {
    validateLicense('ub_builder_old')
    const upgraded = validateLicense('ub_pro_new')
    expect(upgraded.tier).toBe('pro')
  })
})

describe('hasFeature', () => {
  beforeEach(() => {
    resetLicenseCache()
    vi.stubEnv('UNBLOCKS_LICENSE_KEY', '')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns false for community tier', () => {
    expect(hasFeature('uploads.s3')).toBe(false)
  })

  it('returns true for feature in current tier', () => {
    vi.stubEnv('UNBLOCKS_LICENSE_KEY', 'ub_pro_abc')
    expect(hasFeature('uploads.s3')).toBe(true)
  })

  it('returns false for feature not in current tier', () => {
    vi.stubEnv('UNBLOCKS_LICENSE_KEY', 'ub_builder_abc')
    expect(hasFeature('uploads.s3')).toBe(false)
  })
})

describe('getLicenseTier', () => {
  beforeEach(() => {
    resetLicenseCache()
    vi.stubEnv('UNBLOCKS_LICENSE_KEY', '')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns community when no key', () => {
    expect(getLicenseTier()).toBe('community')
  })

  it('returns correct tier from env key', () => {
    vi.stubEnv('UNBLOCKS_LICENSE_KEY', 'ub_ent_abc')
    expect(getLicenseTier()).toBe('enterprise')
  })
})

describe('resetLicenseCache', () => {
  it('clears cached license so next call re-evaluates', () => {
    vi.stubEnv('UNBLOCKS_LICENSE_KEY', 'ub_pro_abc')
    validateLicense()
    expect(getLicenseTier()).toBe('pro')

    resetLicenseCache()
    vi.stubEnv('UNBLOCKS_LICENSE_KEY', '')
    expect(getLicenseTier()).toBe('community')
    vi.unstubAllEnvs()
  })
})
