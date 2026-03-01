import { getDb } from '../db/client'
import { notifications, notificationPreferences } from '../db/schema/notifications'
import { runHook } from '../runtime/hookRunner'
import { eq, and } from 'drizzle-orm'
import type {
  Notification,
  CreateNotificationInput,
  OnNotificationCreatedArgs,
} from './types'

/**
 * Create a notification for a user.
 * Respects user preferences — skips if user has disabled the category.
 */
export async function createNotification(
  input: CreateNotificationInput
): Promise<Notification | null> {
  const db = getDb()

  // Check user preferences
  const prefs = await db
    .select()
    .from(notificationPreferences)
    .where(
      and(
        eq(notificationPreferences.userId, input.userId),
        eq(notificationPreferences.category, input.category)
      )
    )
    .limit(1)

  // If user has preferences and disabled in-app, skip
  if (prefs.length > 0 && !prefs[0].inApp) {
    return null
  }

  const [row] = await db
    .insert(notifications)
    .values({
      userId: input.userId,
      category: input.category,
      type: input.type ?? 'info',
      title: input.title,
      body: input.body,
      actionUrl: input.actionUrl ?? null,
      metadata: input.metadata ?? {},
    })
    .returning()

  const notification = toNotification(row)

  // Add to SSE broadcast queue
  addToStream(input.userId, notification)

  const hookArgs: OnNotificationCreatedArgs = { notification }
  await runHook('onNotificationCreated', hookArgs)

  return notification
}

/**
 * Create notifications for multiple users at once.
 */
export async function createBulkNotifications(
  userIds: string[],
  notification: Omit<CreateNotificationInput, 'userId'>
): Promise<number> {
  let count = 0

  for (const userId of userIds) {
    const result = await createNotification({ ...notification, userId })
    if (result) count++
  }

  return count
}

// --- SSE Stream ---

type StreamCallback = (notification: Notification) => void
const streams = new Map<string, Set<StreamCallback>>()

export function subscribeToStream(
  userId: string,
  callback: StreamCallback
): () => void {
  if (!streams.has(userId)) {
    streams.set(userId, new Set())
  }

  streams.get(userId)!.add(callback)

  return () => {
    const userStreams = streams.get(userId)
    if (userStreams) {
      userStreams.delete(callback)
      if (userStreams.size === 0) {
        streams.delete(userId)
      }
    }
  }
}

function addToStream(userId: string, notification: Notification): void {
  const userStreams = streams.get(userId)
  if (userStreams) {
    for (const callback of userStreams) {
      try {
        callback(notification)
      } catch {
        // Ignore stream errors
      }
    }
  }
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
