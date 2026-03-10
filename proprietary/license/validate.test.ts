import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  validateLicenseKey,
  getLicenseEntitlements,
  canRemoveAttribution,
  clearLicenseCache,
} from './validate'
import {
  DEFAULT_ENTITLEMENTS,
  PRO_ENTITLEMENTS,
  ENTERPRISE_ENTITLEMENTS,
} from './types'

describe('validateLicenseKey', () => {
  it('returns DEFAULT for undefined', () => {
    expect(validateLicenseKey(undefined)).toEqual(DEFAULT_ENTITLEMENTS)
  })

  it('returns DEFAULT for empty string', () => {
    expect(validateLicenseKey('')).toEqual(DEFAULT_ENTITLEMENTS)
  })

  it('returns DEFAULT for whitespace-only', () => {
    expect(validateLicenseKey('   ')).toEqual(DEFAULT_ENTITLEMENTS)
  })

  it('returns PRO for valid pro key', () => {
    const key = 'ub_pro_abc123def456xyz'
    expect(validateLicenseKey(key)).toEqual(PRO_ENTITLEMENTS)
  })

  it('returns ENTERPRISE for valid enterprise key', () => {
    const key = 'ub_ent_abc123def456xyz'
    expect(validateLicenseKey(key)).toEqual(ENTERPRISE_ENTITLEMENTS)
  })

  it('returns DEFAULT for key with wrong prefix', () => {
    const key = 'ub_xxx_abc123def456xyz'
    expect(validateLicenseKey(key)).toEqual(DEFAULT_ENTITLEMENTS)
  })

  it('returns DEFAULT for key that is too short', () => {
    expect(validateLicenseKey('ub_pro_short')).toEqual(DEFAULT_ENTITLEMENTS)
    expect(validateLicenseKey('ub_ent_short')).toEqual(DEFAULT_ENTITLEMENTS)
  })
})

describe('getLicenseEntitlements', () => {
  beforeEach(() => {
    clearLicenseCache()
    vi.unstubAllEnvs()
  })

  it('reads from env', () => {
    vi.stubEnv('UNBLOCKS_LICENSE_KEY', 'ub_pro_abc123def456xyz')
    expect(getLicenseEntitlements()).toEqual(PRO_ENTITLEMENTS)
  })

  it('caches result', () => {
    vi.stubEnv('UNBLOCKS_LICENSE_KEY', 'ub_pro_abc123def456xyz')
    const first = getLicenseEntitlements()

    vi.stubEnv('UNBLOCKS_LICENSE_KEY', 'ub_ent_abc123def456xyz')
    const second = getLicenseEntitlements()

    expect(first).toEqual(PRO_ENTITLEMENTS)
    expect(second).toEqual(PRO_ENTITLEMENTS)
  })
})

describe('canRemoveAttribution', () => {
  beforeEach(() => {
    clearLicenseCache()
    vi.unstubAllEnvs()
  })

  it('returns false for community', () => {
    vi.stubEnv('UNBLOCKS_LICENSE_KEY', '')
    expect(canRemoveAttribution()).toBe(false)
  })

  it('returns true for pro', () => {
    vi.stubEnv('UNBLOCKS_LICENSE_KEY', 'ub_pro_abc123def456xyz')
    expect(canRemoveAttribution()).toBe(true)
  })
})

describe('clearLicenseCache', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  it('clears cached entitlements so next call re-reads env', () => {
    vi.stubEnv('UNBLOCKS_LICENSE_KEY', 'ub_pro_abc123def456xyz')
    expect(getLicenseEntitlements()).toEqual(PRO_ENTITLEMENTS)

    clearLicenseCache()

    vi.stubEnv('UNBLOCKS_LICENSE_KEY', 'ub_ent_abc123def456xyz')
    expect(getLicenseEntitlements()).toEqual(ENTERPRISE_ENTITLEMENTS)
  })
})
