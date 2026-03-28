import { cookies, headers } from 'next/headers'
import { validateSession } from '@unblocks/core/auth'
import { SESSION_COOKIE_NAME } from '@unblocks/core/security/cookies'
import { validateApiKey } from '@unblocks/core/api-keys'
import { AuthError } from '@unblocks/core/errors/types'
import type { User } from '@unblocks/core/auth/types'
import { eq } from 'drizzle-orm'
import { getDb } from '@unblocks/core/db/client'
import { users } from '@unblocks/core/db/schema/users'

/**
 * Get the current user from either session cookie or API key.
 * Session cookie takes priority if both are present.
 */
export async function getCurrentUser(): Promise<User | null> {
  // Try session cookie first
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)

  if (sessionCookie?.value) {
    const result = await validateSession(sessionCookie.value)
    return result?.user ?? null
  }

  // Fall back to API key (forwarded by middleware via x-api-key header)
  const headerStore = await headers()
  const apiKey = headerStore.get('x-api-key')

  if (apiKey) {
    const validation = await validateApiKey(apiKey)
    if (validation.valid && validation.userId) {
      const db = getDb()
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, validation.userId))
        .limit(1)
      return (user as User) ?? null
    }
  }

  return null
}

export async function requireAuth(): Promise<User> {
  const user = await getCurrentUser()
  if (!user) {
    throw new AuthError('NOT_AUTHENTICATED', 'Authentication required')
  }
  return user
}
