import type { MarketplaceConfig } from '@unblocks/blocks/marketplace/types'

const config: MarketplaceConfig = {
  enabled: true,
  commissionPercent: 10,
  minPrice: 100,
  maxPrice: 1_000_000_00,
  currency: 'usd',
  reviewsEnabled: true,
  maxImagesPerListing: 10,
  categories: [
    { id: 'digital', name: 'Digital Products', description: 'Software, templates, assets' },
    { id: 'services', name: 'Services', description: 'Consulting, development, design' },
    { id: 'physical', name: 'Physical Products', description: 'Hardware, merchandise' },
  ],
  requireSellerVerification: false,
  payouts: {
    enabled: true,
    minPayoutAmount: 5000,
    payoutSchedule: 'weekly',
  },
}

export default config
