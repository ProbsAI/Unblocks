import { z } from 'zod'

export const LicenseTier = z.enum(['community', 'pro', 'enterprise'])
export type LicenseTier = z.infer<typeof LicenseTier>

export interface LicenseEntitlements {
  /** Can disable "Built with Unblocks" footer attribution */
  removeAttribution: boolean
  /** Can use white-label branding */
  whiteLabel: boolean
  /** Tier name for display */
  tier: LicenseTier
}

export const DEFAULT_ENTITLEMENTS: LicenseEntitlements = {
  removeAttribution: false,
  whiteLabel: false,
  tier: 'community',
}

export const PRO_ENTITLEMENTS: LicenseEntitlements = {
  removeAttribution: true,
  whiteLabel: false,
  tier: 'pro',
}

export const ENTERPRISE_ENTITLEMENTS: LicenseEntitlements = {
  removeAttribution: true,
  whiteLabel: true,
  tier: 'enterprise',
}
