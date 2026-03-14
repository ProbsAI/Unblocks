import { eq, desc, and, like, sql } from 'drizzle-orm'
import { getDb } from '../../core/db/client'
import { listings } from './schema'
import { NotFoundError } from '../../core/errors/types'
import type { Listing, ListingStatus, ListingType } from './types'

/**
 * Create a new listing.
 */
export async function createListing(
  sellerId: string,
  data: {
    title: string
    description: string
    type?: ListingType
    price: number
    currency?: string
    images?: string[]
    category: string
    tags?: string[]
  }
): Promise<Listing> {
  const db = getDb()

  const [row] = await db
    .insert(listings)
    .values({
      sellerId,
      title: data.title,
      description: data.description,
      type: data.type ?? 'product',
      price: data.price,
      currency: data.currency ?? 'usd',
      images: data.images ?? [],
      category: data.category,
      tags: data.tags ?? [],
      status: 'draft',
    })
    .returning()

  return toListing(row)
}

/**
 * Get a listing by ID. Increments view count.
 */
export async function getListing(id: string): Promise<Listing> {
  const db = getDb()

  const rows = await db
    .select()
    .from(listings)
    .where(eq(listings.id, id))
    .limit(1)

  if (rows.length === 0) {
    throw new NotFoundError('Listing not found')
  }

  // Increment view count
  await db
    .update(listings)
    .set({ viewCount: sql`${listings.viewCount} + 1` })
    .where(eq(listings.id, id))

  return toListing(rows[0])
}

/**
 * Search listings.
 */
export async function searchListings(options?: {
  query?: string
  category?: string
  minPrice?: number
  maxPrice?: number
  limit?: number
  offset?: number
}): Promise<{ listings: Listing[]; total: number }> {
  const db = getDb()
  const limit = options?.limit ?? 20
  const offset = options?.offset ?? 0

  const conditions = [eq(listings.status, 'active')]
  if (options?.category) {
    conditions.push(eq(listings.category, options.category))
  }
  if (options?.query) {
    conditions.push(like(listings.title, `%${options.query}%`))
  }

  const rows = await db
    .select()
    .from(listings)
    .where(and(...conditions))
    .orderBy(desc(listings.createdAt))
    .limit(limit)
    .offset(offset)

  return {
    listings: rows.map(toListing),
    total: rows.length,
  }
}

/**
 * Get listings for a seller.
 */
export async function getSellerListings(
  sellerId: string
): Promise<Listing[]> {
  const db = getDb()

  const rows = await db
    .select()
    .from(listings)
    .where(eq(listings.sellerId, sellerId))
    .orderBy(desc(listings.createdAt))

  return rows.map(toListing)
}

/**
 * Update listing status.
 */
export async function updateListingStatus(
  id: string,
  status: ListingStatus
): Promise<void> {
  const db = getDb()

  await db
    .update(listings)
    .set({ status, updatedAt: new Date() })
    .where(eq(listings.id, id))
}

function toListing(row: typeof listings.$inferSelect): Listing {
  return {
    id: row.id,
    sellerId: row.sellerId,
    title: row.title,
    description: row.description,
    type: row.type as ListingType,
    price: row.price,
    currency: row.currency,
    images: (row.images ?? []) as string[],
    category: row.category,
    tags: (row.tags ?? []) as string[],
    status: row.status as ListingStatus,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    viewCount: row.viewCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}
