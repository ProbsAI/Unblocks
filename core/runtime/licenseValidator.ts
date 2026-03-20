/**
 * License Validator
 *
 * Validates UNBLOCKS_LICENSE_KEY to determine the user's tier and
 * which premium core features are available. This is separate from
 * block availability (which is determined by package installation).
 *
 * Tiers:
 *   community  — free, all MIT features
 *   builder    — attribution removal
 *   pro        — advanced admin, SSE, S3, premium templates/themes
 *   team       — pro + team seats + priority
 *   enterprise — custom, team + SSO, audit, compliance
 */

export type LicenseTier = 'community' | 'builder' | 'pro' | 'team' | 'enterprise'

export interface LicenseInfo {
  valid: boolean
  tier: LicenseTier
  features: string[]
  expiresAt: Date | null
}

/** Features available per tier */
const TIER_FEATURES: Record<LicenseTier, string[]> = {
  community: [],
  builder: [
    'attribution.remove',
  ],
  pro: [
    'attribution.remove',
    'admin.advanced',
    'notifications.sse',
    'uploads.s3',
    'templates.premium',
    'themes.premium',
    'connectors.pro',
  ],
  team: [
    'attribution.remove',
    'admin.advanced',
    'notifications.sse',
    'uploads.s3',
    'templates.premium',
    'themes.premium',
    'connectors.pro',
    'team.seats',
    'support.priority',
  ],
  enterprise: [
    'attribution.remove',
    'admin.advanced',
    'notifications.sse',
    'uploads.s3',
    'templates.premium',
    'themes.premium',
    'connectors.pro',
    'team.seats',
    'support.priority',
    'sso',
    'audit.logging',
    'compliance',
    'connectors.enterprise',
  ],
}

let _cachedLicense: LicenseInfo | null = null
let _cachedKey: string | undefined

/**
 * Validate the license key and return tier info.
 *
 * Currently uses a simple key-prefix convention for development:
 *   - Keys starting with `ub_builder_` → builder tier
 *   - Keys starting with `ub_pro_` → pro tier
 *   - Keys starting with `ub_team_` → team tier
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
  else if (licenseKey.startsWith('ub_team_')) tier = 'team'
  else if (licenseKey.startsWith('ub_pro_')) tier = 'pro'
  else if (licenseKey.startsWith('ub_builder_')) tier = 'builder'

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
