import { eq } from 'drizzle-orm'
import { getDb } from '../db/client'
import { sessions } from '../db/schema/sessions'

export async function revokeSession(sessionId: string): Promise<void> {
  const db = getDb()
  await db.delete(sessions).where(eq(sessions.id, sessionId))
}

export async function revokeSessionByToken(token: string): Promise<void> {
  const db = getDb()
  await db.delete(sessions).where(eq(sessions.token, token))
}

export async function revokeAllSessions(userId: string): Promise<void> {
  const db = getDb()
  await db.delete(sessions).where(eq(sessions.userId, userId))
}
