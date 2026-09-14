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
    if (!validation.valid || !validation.userId) return null

    // Fail closed on scoped keys. validateApiKey returns the key's scopes, but
    // no route checks them, so honouring a key issued as ['teams:read'] would
    // silently grant it everything — writes and issuing further keys included.
    // Until per-route scope checks exist, only a wildcard key is accepted;
    // rejecting a narrow key is the safe direction, granting it more than its
    // issuer asked for is not.
    if (!validation.scopes.includes('*')) return null

    // Same reasoning for the team boundary. validateApiKey reports the key's
    // teamId, and no route enforces one, so accepting a team-scoped key here
    // would silently widen it into a credential for everything the user can
    // reach. createApiKey refuses to issue these, but a row predating that
    // guard — or written directly — must not be honoured either.
    if (validation.teamId) return null

    const db = getDb()

    // Project explicitly rather than selecting the row and casting it. The full
    // row carries passwordHash, encrypted PII and login metadata that the User
    // interface deliberately omits — a cast hides them from the type but not
    // from anything that serialises the value. This mirrors validateSession.
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        avatarUrl: users.avatarUrl,
        emailVerified: users.emailVerified,
        status: users.status,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.id, validation.userId))
      .limit(1)

    // Parity with the session path, which rejects any non-active user. Without
    // this, suspending or banning an account leaves its existing API keys
    // authorising every protected endpoint.
    if (!user || user.status !== 'active') return null

    return user
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
