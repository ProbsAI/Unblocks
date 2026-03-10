import {
  DEFAULT_ENTITLEMENTS,
  PRO_ENTITLEMENTS,
  ENTERPRISE_ENTITLEMENTS,
  type LicenseEntitlements,
} from './types'

/**
 * Validate an Unblocks license key and return entitlements.
 *
 * In production, this will call the Unblocks license server.
 * For now, it uses a simple prefix-based check:
 *   - Keys starting with "ub_pro_" → Pro entitlements
 *   - Keys starting with "ub_ent_" → Enterprise entitlements
 *   - Empty/invalid → Community (default) entitlements
 *
 * TODO: Replace with server-side license validation against
 * https://api.unblocks.ai/v1/license/validate
 */
export function validateLicenseKey(key: string | undefined): LicenseEntitlements {
  if (!key || key.trim() === '') {
    return DEFAULT_ENTITLEMENTS
  }

  const trimmed = key.trim()

  if (trimmed.startsWith('ub_ent_') && trimmed.length >= 20) {
    return ENTERPRISE_ENTITLEMENTS
  }

  if (trimmed.startsWith('ub_pro_') && trimmed.length >= 20) {
    return PRO_ENTITLEMENTS
  }

  // Invalid key format — treat as community
  return DEFAULT_ENTITLEMENTS
}

let _cachedEntitlements: LicenseEntitlements | null = null

/**
 * Get license entitlements, caching the result.
 * Reads from UNBLOCKS_LICENSE_KEY env var or app config.
 */
export function getLicenseEntitlements(): LicenseEntitlements {
  if (_cachedEntitlements) return _cachedEntitlements

  const key = process.env.UNBLOCKS_LICENSE_KEY ?? ''
  _cachedEntitlements = validateLicenseKey(key)
  return _cachedEntitlements
}

/**
 * Check if the current license allows removing attribution.
 */
export function canRemoveAttribution(): boolean {
  return getLicenseEntitlements().removeAttribution
}

/** Clear cached entitlements (for testing). */
export function clearLicenseCache(): void {
  _cachedEntitlements = null
}
