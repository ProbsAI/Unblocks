import { eq, and } from 'drizzle-orm'
import { getDb } from '../db/client'
import { notificationPreferences } from '../db/schema/notifications'
import { loadConfig } from '../runtime/configLoader'
import type { NotificationPreference } from './types'

/**
 * Get notification preferences for a user.
 * Returns defaults from config for categories not yet configured.
 */
export async function getPreferences(
  userId: string
): Promise<NotificationPreference[]> {
  const config = loadConfig('notifications')
  const db = getDb()

  const rows = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId))

  const prefsMap = new Map(rows.map((r) => [r.category, r]))

  return config.categories.map((cat) => {
    const existing = prefsMap.get(cat.id)
    return {
      id: existing?.id ?? '',
      userId,
      category: cat.id,
      inApp: existing?.inApp ?? cat.defaultEnabled,
      email: existing?.email ?? (config.channels.email && cat.defaultEnabled),
    }
  })
}

/**
 * Update notification preferences for a category.
 */
export async function updatePreference(
  userId: string,
  category: string,
  updates: { inApp?: boolean; email?: boolean }
): Promise<NotificationPreference> {
  const db = getDb()

  const existing = await db
    .select()
    .from(notificationPreferences)
    .where(
      and(
        eq(notificationPreferences.userId, userId),
        eq(notificationPreferences.category, category)
      )
    )
    .limit(1)

  if (existing.length > 0) {
    const [updated] = await db
      .update(notificationPreferences)
      .set({
        ...(updates.inApp !== undefined ? { inApp: updates.inApp } : {}),
        ...(updates.email !== undefined ? { email: updates.email } : {}),
      })
      .where(eq(notificationPreferences.id, existing[0].id))
      .returning()

    return toPref(updated)
  }

  const [created] = await db
    .insert(notificationPreferences)
    .values({
      userId,
      category,
      inApp: updates.inApp ?? true,
      email: updates.email ?? false,
    })
    .returning()

  return toPref(created)
}

function toPref(
  row: typeof notificationPreferences.$inferSelect
): NotificationPreference {
  return {
    id: row.id,
    userId: row.userId,
    category: row.category,
    inApp: row.inApp,
    email: row.email,
  }
}
