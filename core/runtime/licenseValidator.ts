/**
 * License Validator
 *
 * Validates UNBLOCKS_LICENSE_KEY to determine the user's tier and
 * which premium features are available. This is separate from
 * block availability (which is determined by package installation).
 *
 * Free/community tier includes ALL core features: auth, billing, AI,
 * API keys, teams, jobs, uploads (incl. S3), notifications (incl. SSE),
 * admin, email, and full UI components.
 *
 * Tiers:
 *   community  — free, all core features (MIT)
 *   pro        — data-platform block, marketplace block, advanced analytics, premium templates
 *   business   — pro + white-labeling, audit logging, metered billing
 *   enterprise — business + SSO/SAML/SCIM, multi-tenancy, compliance, SLA
 */

export type LicenseTier = 'community' | 'pro' | 'business' | 'enterprise'

export interface LicenseInfo {
  valid: boolean
  tier: LicenseTier
  features: string[]
  expiresAt: Date | null
}

/** Features available per tier (cumulative — each tier includes all lower tiers) */
const TIER_FEATURES: Record<LicenseTier, string[]> = {
  community: [],
  pro: [
    'attribution.remove',
    'blocks.data_platform',
    'blocks.marketplace',
    'analytics.advanced',
    'templates.premium',
    'themes.premium',
    'connectors.pro',
    'support.priority',
  ],
  business: [
    'attribution.remove',
    'blocks.data_platform',
    'blocks.marketplace',
    'analytics.advanced',
    'templates.premium',
    'themes.premium',
    'connectors.pro',
    'support.priority',
    'whitelabel',
    'audit.logging',
    'billing.metered',
  ],
  enterprise: [
    'attribution.remove',
    'blocks.data_platform',
    'blocks.marketplace',
    'analytics.advanced',
    'templates.premium',
    'themes.premium',
    'connectors.pro',
    'support.priority',
    'whitelabel',
    'audit.logging',
    'billing.metered',
    'sso',
    'scim',
    'multi_tenancy',
    'compliance',
    'connectors.enterprise',
    'support.sla',
  ],
}

let _cachedLicense: LicenseInfo | null = null
let _cachedKey: string | undefined

/**
 * Validate the license key and return tier info.
 *
 * Currently uses a simple key-prefix convention for development:
 *   - Keys starting with `ub_pro_` → pro tier
 *   - Keys starting with `ub_biz_` → business tier
 *   - Keys starting with `ub_ent_` → enterprise tier
 *
 * In production, this would verify a signed JWT or call a license API.
 */
export function validateLicense(key?: string): LicenseInfo {
  const licenseKey = key ?? process.env.UNBLOCKS_LICENSE_KEY

  // Return cached result only when the resolved key matches
  if (_cachedLicense && _cachedKey === licenseKey) return _cachedLicense

  if (!licenseKey) {
    _cachedKey = licenseKey
    _cachedLicense = { valid: false, tier: 'community', features: [], expiresAt: null }
    return _cachedLicense
  }

  // Determine tier from key prefix (dev convention; production uses JWT/API)
  let tier: LicenseTier = 'community'
  if (licenseKey.startsWith('ub_ent_')) tier = 'enterprise'
  else if (licenseKey.startsWith('ub_biz_')) tier = 'business'
  else if (licenseKey.startsWith('ub_pro_')) tier = 'pro'

  _cachedKey = licenseKey
  if (tier === 'community') {
    _cachedLicense = { valid: false, tier: 'community', features: [], expiresAt: null }
    return _cachedLicense
  }

  _cachedLicense = {
    valid: true,
    tier,
    features: TIER_FEATURES[tier],
    expiresAt: null, // TODO: extract from JWT in production
  }
  return _cachedLicense
}

/**
 * Check if a specific feature is available under the current license.
 */
export function hasFeature(feature: string): boolean {
  const license = validateLicense()
  return license.features.includes(feature)
}

/**
 * Get the current license tier.
 */
export function getLicenseTier(): LicenseTier {
  return validateLicense().tier
}

/**
 * Reset cached license. Used for testing.
 */
export function resetLicenseCache(): void {
  _cachedLicense = null
  _cachedKey = undefined
}
