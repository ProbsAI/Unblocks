import { eq, and, gt } from 'drizzle-orm'
import { getDb } from '../db/client'
import { sessions } from '../db/schema/sessions'
import { users } from '../db/schema/users'
import { verifyToken } from './token'
import { blindIndex } from '../security/blindIndex'
import type { User } from './types'

export interface ValidatedSession {
  user: User
  sessionId: string
}

export async function validateSession(
  token: string
): Promise<ValidatedSession | null> {
  // Verify JWT signature and expiry
  const payload = await verifyToken(token)
  if (!payload || payload.type !== 'session') return null

  const db = getDb()

  // Check session exists and isn't expired
  const [session] = await db
    .select()
    .from(sessions)
    .where(
      and(
        eq(sessions.token, blindIndex(token)),
        gt(sessions.expiresAt, new Date())
      )
    )
    .limit(1)

  if (!session) return null

  // Get user
  const [dbUser] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1)

  if (!dbUser || dbUser.status !== 'active') return null

  return {
    user: {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      avatarUrl: dbUser.avatarUrl,
      emailVerified: dbUser.emailVerified,
      status: dbUser.status,
      createdAt: dbUser.createdAt,
      updatedAt: dbUser.updatedAt,
    },
    sessionId: session.id,
  }
}
