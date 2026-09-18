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

  it('parses pro key prefix', () => {
    const info = validateLicense('ub_pro_abc123')
    expect(info.valid).toBe(true)
    expect(info.tier).toBe('pro')
    expect(info.features).toContain('attribution.remove')
    expect(info.features).toContain('blocks.data_platform')
    expect(info.features).toContain('blocks.marketplace')
    expect(info.features).toContain('templates.premium')
  })

  it('parses business key prefix', () => {
    const info = validateLicense('ub_biz_abc123')
    expect(info.valid).toBe(true)
    expect(info.tier).toBe('business')
    expect(info.features).toContain('whitelabel')
    expect(info.features).toContain('audit.logging')
    expect(info.features).toContain('billing.metered')
    // Business includes all pro features
    expect(info.features).toContain('blocks.data_platform')
    expect(info.features).toContain('support.priority')
  })

  it('parses enterprise key prefix', () => {
    const info = validateLicense('ub_ent_abc123')
    expect(info.valid).toBe(true)
    expect(info.tier).toBe('enterprise')
    expect(info.features).toContain('sso')
    expect(info.features).toContain('scim')
    expect(info.features).toContain('multi_tenancy')
    expect(info.features).toContain('compliance')
    expect(info.features).toContain('support.sla')
    // Enterprise includes all business features
    expect(info.features).toContain('whitelabel')
    expect(info.features).toContain('audit.logging')
  })

  it('returns invalid for unrecognized key prefix', () => {
    const info = validateLicense('invalid_key_format')
    expect(info.valid).toBe(false)
    expect(info.tier).toBe('community')
  })

  it('returns invalid for old builder key prefix (removed tier)', () => {
    const info = validateLicense('ub_builder_abc123')
    expect(info.valid).toBe(false)
    expect(info.tier).toBe('community')
  })

  it('returns invalid for old team key prefix (renamed to business)', () => {
    const info = validateLicense('ub_team_abc123')
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

    const biz = validateLicense('ub_biz_xyz')
    expect(biz.tier).toBe('business')
  })

  it('does not return stale cache after key rotation', () => {
    validateLicense('ub_pro_old')
    const upgraded = validateLicense('ub_biz_new')
    expect(upgraded.tier).toBe('business')
  })

  it('community tier has zero premium features', () => {
    const info = validateLicense()
    expect(info.features).toHaveLength(0)
  })

  it('each tier is a superset of the tier below', () => {
    const pro = validateLicense('ub_pro_a')
    resetLicenseCache()
    const biz = validateLicense('ub_biz_a')
    resetLicenseCache()
    const ent = validateLicense('ub_ent_a')

    // All pro features should be in business
    for (const f of pro.features) {
      expect(biz.features).toContain(f)
    }
    // All business features should be in enterprise
    for (const f of biz.features) {
      expect(ent.features).toContain(f)
    }
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

  it('returns false for community tier (all features are premium)', () => {
    expect(hasFeature('blocks.data_platform')).toBe(false)
    expect(hasFeature('sso')).toBe(false)
    expect(hasFeature('whitelabel')).toBe(false)
  })

  it('returns true for feature in current tier', () => {
    vi.stubEnv('UNBLOCKS_LICENSE_KEY', 'ub_pro_abc')
    expect(hasFeature('blocks.data_platform')).toBe(true)
    expect(hasFeature('blocks.marketplace')).toBe(true)
  })

  it('returns false for feature above current tier', () => {
    vi.stubEnv('UNBLOCKS_LICENSE_KEY', 'ub_pro_abc')
    expect(hasFeature('sso')).toBe(false)
    expect(hasFeature('whitelabel')).toBe(false)
  })

  it('returns true for enterprise features on enterprise tier', () => {
    vi.stubEnv('UNBLOCKS_LICENSE_KEY', 'ub_ent_abc')
    expect(hasFeature('sso')).toBe(true)
    expect(hasFeature('scim')).toBe(true)
    expect(hasFeature('multi_tenancy')).toBe(true)
    expect(hasFeature('compliance')).toBe(true)
  })

  it('returns false for nonexistent feature', () => {
    vi.stubEnv('UNBLOCKS_LICENSE_KEY', 'ub_ent_abc')
    expect(hasFeature('nonexistent.feature')).toBe(false)
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

  it('returns business for ub_biz_ prefix', () => {
    vi.stubEnv('UNBLOCKS_LICENSE_KEY', 'ub_biz_abc')
    expect(getLicenseTier()).toBe('business')
  })
})

describe('resetLicenseCache', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('clears cached license so next call re-evaluates', () => {
    vi.stubEnv('UNBLOCKS_LICENSE_KEY', 'ub_pro_abc')
    validateLicense()
    expect(getLicenseTier()).toBe('pro')

    resetLicenseCache()
    vi.stubEnv('UNBLOCKS_LICENSE_KEY', '')
    expect(getLicenseTier()).toBe('community')
  })
})
