import { cookies } from 'next/headers'
import { validateSession } from '@unblocks/core/auth'
import { SESSION_COOKIE_NAME } from '@unblocks/core/security/cookies'
import { AuthError } from '@unblocks/core/errors/types'
import type { User } from '@unblocks/core/auth/types'

export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)

  if (!sessionCookie?.value) return null

  const result = await validateSession(sessionCookie.value)
  return result?.user ?? null
}

export async function requireAuth(): Promise<User> {
  const user = await getCurrentUser()
  if (!user) {
    throw new AuthError('NOT_AUTHENTICATED', 'Authentication required')
  }
  return user
}
