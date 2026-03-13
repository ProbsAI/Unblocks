import { eq } from 'drizzle-orm'
import { getDb } from '../../core/db/client'
import { sellerProfiles } from './schema'
import { NotFoundError, ConflictError } from '../../core/errors/types'
import type { SellerProfile } from './types'

/**
 * Create a seller profile for a user.
 */
export async function createSellerProfile(
  userId: string,
  data: {
    displayName: string
    bio?: string
    avatarUrl?: string
  }
): Promise<SellerProfile> {
  const db = getDb()

  // Check if already exists
  const existing = await db
    .select({ id: sellerProfiles.id })
    .from(sellerProfiles)
    .where(eq(sellerProfiles.userId, userId))
    .limit(1)

  if (existing.length > 0) {
    throw new ConflictError('Seller profile already exists')
  }

  const [row] = await db
    .insert(sellerProfiles)
    .values({
      userId,
      displayName: data.displayName,
      bio: data.bio ?? '',
      avatarUrl: data.avatarUrl ?? null,
    })
    .returning()

  return toSellerProfile(row)
}

/**
 * Get a seller profile by user ID.
 */
export async function getSellerProfile(
  userId: string
): Promise<SellerProfile> {
  const db = getDb()

  const rows = await db
    .select()
    .from(sellerProfiles)
    .where(eq(sellerProfiles.userId, userId))
    .limit(1)

  if (rows.length === 0) {
    throw new NotFoundError('Seller profile not found')
  }

  return toSellerProfile(rows[0])
}

/**
 * Update a seller profile.
 */
export async function updateSellerProfile(
  userId: string,
  data: {
    displayName?: string
    bio?: string
    avatarUrl?: string
  }
): Promise<SellerProfile> {
  const db = getDb()

  const [row] = await db
    .update(sellerProfiles)
    .set({
      ...(data.displayName ? { displayName: data.displayName } : {}),
      ...(data.bio !== undefined ? { bio: data.bio } : {}),
      ...(data.avatarUrl !== undefined ? { avatarUrl: data.avatarUrl } : {}),
    })
    .where(eq(sellerProfiles.userId, userId))
    .returning()

  if (!row) {
    throw new NotFoundError('Seller profile not found')
  }

  return toSellerProfile(row)
}

function toSellerProfile(
  row: typeof sellerProfiles.$inferSelect
): SellerProfile {
  return {
    id: row.id,
    userId: row.userId,
    displayName: row.displayName,
    bio: row.bio ?? '',
    avatarUrl: row.avatarUrl,
    rating: row.rating,
    totalSales: row.totalSales,
    totalRevenue: row.totalRevenue,
    verified: row.verified,
    createdAt: row.createdAt,
  }
}
