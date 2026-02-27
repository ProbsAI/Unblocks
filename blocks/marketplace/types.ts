import { z } from 'zod'

// --- Listing ---

export type ListingStatus = 'draft' | 'active' | 'paused' | 'sold' | 'archived'
export type ListingType = 'product' | 'service' | 'digital' | 'subscription'

export interface Listing {
  id: string
  sellerId: string
  title: string
  description: string
  type: ListingType
  price: number
  currency: string
  images: string[]
  category: string
  tags: string[]
  status: ListingStatus
  metadata: Record<string, unknown>
  viewCount: number
  createdAt: Date
  updatedAt: Date
}

// --- Order ---

export type OrderStatus = 'pending' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded'

export interface Order {
  id: string
  buyerId: string
  sellerId: string
  listingId: string
  quantity: number
  totalPrice: number
  currency: string
  status: OrderStatus
  shippingAddress: Record<string, unknown> | null
  metadata: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

// --- Review ---

export interface Review {
  id: string
  orderId: string
  listingId: string
  reviewerId: string
  sellerId: string
  rating: number
  title: string
  body: string
  createdAt: Date
  updatedAt: Date
}

// --- Seller Profile ---

export interface SellerProfile {
  id: string
  userId: string
  displayName: string
  bio: string
  avatarUrl: string | null
  rating: number
  totalSales: number
  totalRevenue: number
  verified: boolean
  createdAt: Date
}

// --- Config ---

export const MarketplaceConfigSchema = z.object({
  /** Enable the marketplace block */
  enabled: z.boolean().default(false),

  /** Commission percentage (0-100) */
  commissionPercent: z.number().min(0).max(100).default(10),

  /** Minimum listing price in cents */
  minPrice: z.number().default(100),

  /** Maximum listing price in cents */
  maxPrice: z.number().default(1_000_000_00),

  /** Default currency */
  currency: z.string().default('usd'),

  /** Enable reviews */
  reviewsEnabled: z.boolean().default(true),

  /** Max images per listing */
  maxImagesPerListing: z.number().default(10),

  /** Categories */
  categories: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().default(''),
  })).default([
    { id: 'digital', name: 'Digital Products', description: 'Software, templates, assets' },
    { id: 'services', name: 'Services', description: 'Consulting, development, design' },
    { id: 'physical', name: 'Physical Products', description: 'Hardware, merchandise' },
  ]),

  /** Require seller verification */
  requireSellerVerification: z.boolean().default(false),

  /** Payout settings */
  payouts: z.object({
    enabled: z.boolean().default(true),
    minPayoutAmount: z.number().default(5000), // $50.00 in cents
    payoutSchedule: z.enum(['daily', 'weekly', 'monthly']).default('weekly'),
  }).default({}),
})

export type MarketplaceConfig = z.infer<typeof MarketplaceConfigSchema>
