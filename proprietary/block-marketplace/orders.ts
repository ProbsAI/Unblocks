import { eq, desc, or } from 'drizzle-orm'
import { getDb } from '../../core/db/client'
import { orders, listings, sellerProfiles } from './schema'
import { NotFoundError, ForbiddenError } from '../../core/errors/types'
import { runHook } from '../../core/runtime/hookRunner'
import { sql } from 'drizzle-orm'
import type { Order, OrderStatus } from './types'

/**
 * Create a new order.
 */
export async function createOrder(
  buyerId: string,
  listingId: string,
  quantity: number = 1
): Promise<Order> {
  const db = getDb()

  // Get listing
  const [listing] = await db
    .select()
    .from(listings)
    .where(eq(listings.id, listingId))
    .limit(1)

  if (!listing) {
    throw new NotFoundError('Listing not found')
  }

  if (listing.status !== 'active') {
    throw new ForbiddenError('Listing is not available')
  }

  if (listing.sellerId === buyerId) {
    throw new ForbiddenError('Cannot buy your own listing')
  }

  const totalPrice = listing.price * quantity

  const [row] = await db
    .insert(orders)
    .values({
      buyerId,
      sellerId: listing.sellerId,
      listingId,
      quantity,
      totalPrice,
      currency: listing.currency,
      status: 'pending',
    })
    .returning()

  await runHook('onMarketplaceOrder', {
    orderId: row.id,
    buyerId,
    sellerId: listing.sellerId,
    listingId,
    totalPrice,
  })

  return toOrder(row)
}

/**
 * Get an order by ID.
 */
export async function getOrder(orderId: string): Promise<Order> {
  const db = getDb()

  const rows = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1)

  if (rows.length === 0) {
    throw new NotFoundError('Order not found')
  }

  return toOrder(rows[0])
}

/**
 * Get orders for a user (as buyer or seller).
 */
export async function getUserOrders(
  userId: string,
  role: 'buyer' | 'seller' | 'both' = 'both'
): Promise<Order[]> {
  const db = getDb()

  const condition =
    role === 'buyer'
      ? eq(orders.buyerId, userId)
      : role === 'seller'
      ? eq(orders.sellerId, userId)
      : or(eq(orders.buyerId, userId), eq(orders.sellerId, userId))

  const rows = await db
    .select()
    .from(orders)
    .where(condition)
    .orderBy(desc(orders.createdAt))

  return rows.map(toOrder)
}

/**
 * Update order status.
 */
export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus
): Promise<void> {
  const db = getDb()
  const now = new Date()

  await db
    .update(orders)
    .set({ status, updatedAt: now })
    .where(eq(orders.id, orderId))

  // If delivered, update seller stats
  if (status === 'delivered') {
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1)

    if (order) {
      await db
        .update(sellerProfiles)
        .set({
          totalSales: sql`${sellerProfiles.totalSales} + 1`,
          totalRevenue: sql`${sellerProfiles.totalRevenue} + ${order.totalPrice}`,
        })
        .where(eq(sellerProfiles.userId, order.sellerId))
    }
  }
}

function toOrder(row: typeof orders.$inferSelect): Order {
  return {
    id: row.id,
    buyerId: row.buyerId,
    sellerId: row.sellerId,
    listingId: row.listingId,
    quantity: row.quantity,
    totalPrice: row.totalPrice,
    currency: row.currency,
    status: row.status as OrderStatus,
    shippingAddress: row.shippingAddress as Record<string, unknown> | null,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}
