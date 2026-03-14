import { eq, desc, sql } from 'drizzle-orm'
import { getDb } from '../../core/db/client'
import { reviews, sellerProfiles, orders } from './schema'
import { ForbiddenError, NotFoundError, ConflictError } from '../../core/errors/types'
import type { Review } from './types'

/**
 * Create a review for a completed order.
 */
export async function createReview(
  reviewerId: string,
  data: {
    orderId: string
    rating: number
    title: string
    body?: string
  }
): Promise<Review> {
  const db = getDb()

  // Get order
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, data.orderId))
    .limit(1)

  if (!order) {
    throw new NotFoundError('Order not found')
  }

  if (order.buyerId !== reviewerId) {
    throw new ForbiddenError('Only the buyer can review')
  }

  if (order.status !== 'delivered') {
    throw new ForbiddenError('Can only review delivered orders')
  }

  // Check for existing review
  const existing = await db
    .select({ id: reviews.id })
    .from(reviews)
    .where(eq(reviews.orderId, data.orderId))
    .limit(1)

  if (existing.length > 0) {
    throw new ConflictError('Order already reviewed')
  }

  // Validate rating
  if (data.rating < 1 || data.rating > 5) {
    throw new ForbiddenError('Rating must be between 1 and 5')
  }

  const [row] = await db
    .insert(reviews)
    .values({
      orderId: data.orderId,
      listingId: order.listingId,
      reviewerId,
      sellerId: order.sellerId,
      rating: data.rating,
      title: data.title,
      body: data.body ?? '',
    })
    .returning()

  // Update seller rating
  const [avgResult] = await db
    .select({
      avg: sql<number>`AVG(${reviews.rating})`,
    })
    .from(reviews)
    .where(eq(reviews.sellerId, order.sellerId))

  if (avgResult.avg) {
    await db
      .update(sellerProfiles)
      .set({ rating: Math.round(avgResult.avg * 10) / 10 })
      .where(eq(sellerProfiles.userId, order.sellerId))
  }

  return toReview(row)
}

/**
 * Get reviews for a listing.
 */
export async function getListingReviews(
  listingId: string,
  limit: number = 20
): Promise<Review[]> {
  const db = getDb()

  const rows = await db
    .select()
    .from(reviews)
    .where(eq(reviews.listingId, listingId))
    .orderBy(desc(reviews.createdAt))
    .limit(limit)

  return rows.map(toReview)
}

/**
 * Get reviews for a seller.
 */
export async function getSellerReviews(
  sellerId: string,
  limit: number = 20
): Promise<Review[]> {
  const db = getDb()

  const rows = await db
    .select()
    .from(reviews)
    .where(eq(reviews.sellerId, sellerId))
    .orderBy(desc(reviews.createdAt))
    .limit(limit)

  return rows.map(toReview)
}

function toReview(row: typeof reviews.$inferSelect): Review {
  return {
    id: row.id,
    orderId: row.orderId,
    listingId: row.listingId,
    reviewerId: row.reviewerId,
    sellerId: row.sellerId,
    rating: row.rating,
    title: row.title,
    body: row.body ?? '',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}
