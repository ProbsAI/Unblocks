import { eq, desc, sql, like, or, type SQL } from 'drizzle-orm'
import { getDb } from '../db/client'
import { users } from '../db/schema/users'
import { subscriptions } from '../db/schema/subscriptions'
import { ForbiddenError } from '../errors/types'
import type { AdminUser } from './types'
import {
  emailMatches,
  piiEncryptionEnabled,
  readEmail,
} from '../security/piiStorage'

/**
 * Check if a user has admin permissions.
 * Admin is determined by the user's role metadata or being the first user.
 */
export async function requireAdmin(userId: string): Promise<void> {
  const db = getDb()

  const [user] = await db
    .select({ metadata: users.metadata })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  const meta = user?.metadata as Record<string, unknown> | null
  if (!meta?.role || meta.role !== 'admin') {
    throw new ForbiddenError('Admin access required')
  }
}

/**
 * List all users with optional search and pagination.
 */
export async function listUsers(options?: {
  search?: string
  limit?: number
  offset?: number
}): Promise<{ users: AdminUser[]; total: number }> {
  const db = getDb()
  const limit = options?.limit ?? 50
  const offset = options?.offset ?? 0

  let baseQuery = db
    .select({
      user: users,
      plan: subscriptions.plan,
      subscriptionStatus: subscriptions.status,
    })
    .from(users)
    .leftJoin(subscriptions, eq(users.id, subscriptions.userId))

  if (options?.search) {
    baseQuery = baseQuery.where(searchCondition(options.search)) as typeof baseQuery
  }

  const rows = await baseQuery
    .orderBy(desc(users.createdAt))
    .limit(limit)
    .offset(offset)

  let countQuery = db
    .select({ count: sql<number>`count(*)` })
    .from(users)

  if (options?.search) {
    countQuery = countQuery.where(searchCondition(options.search)) as typeof countQuery
  }

  const [countResult] = await countQuery

  return {
    users: rows.map((row) => ({
      id: row.user.id,
      email: readEmail(row.user),
      name: row.user.name,
      status: row.user.status,
      emailVerified: row.user.emailVerified,
      loginCount: row.user.loginCount,
      lastLoginAt: row.user.lastLoginAt,
      createdAt: row.user.createdAt,
      plan: row.plan,
      subscriptionStatus: row.subscriptionStatus,
    })),
    total: countResult.count,
  }
}

/**
 * Update a user's status (active, suspended, banned).
 */
export async function updateUserStatus(
  userId: string,
  status: 'active' | 'suspended' | 'banned'
): Promise<void> {
  const db = getDb()

  await db
    .update(users)
    .set({ status, updatedAt: new Date() })
    .where(eq(users.id, userId))
}

/**
 * Set a user as admin.
 */
export async function setUserAdmin(
  userId: string,
  isAdmin: boolean
): Promise<void> {
  const db = getDb()

  const [user] = await db
    .select({ metadata: users.metadata })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  const currentMeta = (user?.metadata ?? {}) as Record<string, unknown>
  const newMeta = { ...currentMeta, role: isAdmin ? 'admin' : 'user' }

  await db
    .update(users)
    .set({ metadata: newMeta, updatedAt: new Date() })
    .where(eq(users.id, userId))
}

/**
 * Admin search, which behaves differently depending on how addresses are stored.
 *
 * A blind index has no substrings, so `LIKE '%term%'` cannot work against it.
 * In encrypted mode the email half of this search is therefore exact-match —
 * type a whole address and it is found, type a fragment and it is not. Name is
 * still substring-searchable either way, because names are not indexed.
 *
 * This is the visible cost of privacy.encryptUserEmail, and it is a product
 * behaviour difference rather than a storage detail. Silently returning nothing
 * for a fragment would look like a broken search.
 */
function searchCondition(search: string): SQL | undefined {
  const namePattern = `%${search}%`

  return piiEncryptionEnabled()
    ? or(emailMatches(search), like(users.name, namePattern))
    : or(like(users.email, `%${search}%`), like(users.name, namePattern))
}
