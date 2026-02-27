import { eq, desc } from 'drizzle-orm'
import { getDb } from '../db/client'
import { notifications } from '../db/schema/notifications'
import type { Notification } from './types'

/**
 * Get notifications for a user, ordered by most recent first.
 */
export async function getNotifications(
  userId: string,
  options?: {
    limit?: number
    offset?: number
    unreadOnly?: boolean
  }
): Promise<{ notifications: Notification[]; total: number }> {
  const db = getDb()
  const limit = options?.limit ?? 50
  const offset = options?.offset ?? 0

  let query = db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))

  if (options?.unreadOnly) {
    query = db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      // Filter to unread only handled at application level below
  }

  const rows = await query
    .orderBy(desc(notifications.createdAt))
    .limit(limit)
    .offset(offset)

  const filtered = options?.unreadOnly
    ? rows.filter((r) => !r.read)
    : rows

  return {
    notifications: filtered.map(toNotification),
    total: filtered.length,
  }
}

/**
 * Delete a notification.
 */
export async function deleteNotification(
  notificationId: string,
  userId: string
): Promise<boolean> {
  const db = getDb()

  const result = await db
    .delete(notifications)
    .where(eq(notifications.id, notificationId))
    .returning({ id: notifications.id })

  return result.length > 0
}

function toNotification(row: typeof notifications.$inferSelect): Notification {
  return {
    id: row.id,
    userId: row.userId,
    category: row.category,
    type: row.type as Notification['type'],
    title: row.title,
    body: row.body,
    actionUrl: row.actionUrl,
    read: row.read,
    readAt: row.readAt,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    createdAt: row.createdAt,
  }
}
