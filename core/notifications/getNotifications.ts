import { eq, and, desc, count } from 'drizzle-orm'
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

  const whereClause = options?.unreadOnly
    ? and(eq(notifications.userId, userId), eq(notifications.read, false))
    : eq(notifications.userId, userId)

  const [rows, totalResult] = await Promise.all([
    db
      .select()
      .from(notifications)
      .where(whereClause)
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: count() })
      .from(notifications)
      .where(whereClause),
  ])

  return {
    notifications: rows.map(toNotification),
    total: totalResult[0]?.count ?? 0,
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
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, userId)
      )
    )
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
