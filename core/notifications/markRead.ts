import { eq, and, sql } from 'drizzle-orm'
import { getDb } from '../db/client'
import { notifications } from '../db/schema/notifications'

/**
 * Mark a single notification as read.
 */
export async function markAsRead(
  notificationId: string,
  userId: string
): Promise<boolean> {
  const db = getDb()
  const now = new Date()

  const result = await db
    .update(notifications)
    .set({ read: true, readAt: now })
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, userId)
      )
    )
    .returning({ id: notifications.id })

  return result.length > 0
}

/**
 * Mark all notifications for a user as read.
 */
export async function markAllAsRead(userId: string): Promise<number> {
  const db = getDb()
  const now = new Date()

  const result = await db
    .update(notifications)
    .set({ read: true, readAt: now })
    .where(
      and(
        eq(notifications.userId, userId),
        eq(notifications.read, false)
      )
    )
    .returning({ id: notifications.id })

  return result.length
}

/**
 * Get the count of unread notifications for a user.
 */
export async function getUnreadCount(userId: string): Promise<number> {
  const db = getDb()

  const [result] = await db
    .select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, userId),
        eq(notifications.read, false)
      )
    )

  return result.count
}
