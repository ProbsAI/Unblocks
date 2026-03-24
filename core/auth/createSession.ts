import { getDb } from '../db/client'
import { sessions } from '../db/schema/sessions'
import { createToken, generateRandomToken } from './token'
import { encrypt } from '../security/encryption'
import { blindIndex } from '../security/blindIndex'
import type { Session } from './types'

export async function createSession(
  userId: string,
  options?: { ipAddress?: string; userAgent?: string }
): Promise<Session> {
  const db = getDb()
  const sessionId = generateRandomToken().slice(0, 32)

  const token = await createToken(
    { userId, sessionId, type: 'session' },
    '7d'
  )

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  const [dbSession] = await db
    .insert(sessions)
    .values({
      userId,
      token,
      tokenHash: blindIndex(token),
      tokenEncrypted: encrypt(token),
      expiresAt,
      ipAddress: options?.ipAddress ?? null,
      userAgent: options?.userAgent ?? null,
    })
    .returning()

  return {
    id: dbSession.id,
    userId: dbSession.userId,
    token: dbSession.token,
    expiresAt: dbSession.expiresAt,
    ipAddress: dbSession.ipAddress,
    userAgent: dbSession.userAgent,
    createdAt: dbSession.createdAt,
  }
}
