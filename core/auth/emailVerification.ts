import { eq, and, gt, isNull } from 'drizzle-orm'
import { getDb } from '../db/client'
import { users } from '../db/schema/users'
import { verificationTokens } from '../db/schema/verificationTokens'
import { generateRandomToken } from './token'
import { AuthError } from '../errors/types'
import { encrypt } from '../security/encryption'
import { blindIndex } from '../security/blindIndex'

export async function createEmailVerificationToken(
  email: string
): Promise<string> {
  const db = getDb()
  const emailLower = email.toLowerCase()

  const token = generateRandomToken()
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

  await db.insert(verificationTokens).values({
    token: blindIndex(token),
    tokenHash: blindIndex(token),
    tokenEncrypted: encrypt(token),
    email: emailLower,
    emailEncrypted: encrypt(emailLower),
    type: 'email_verification',
    expiresAt,
  })

  return token
}

export async function verifyEmail(token: string): Promise<void> {
  const db = getDb()

  const [dbToken] = await db
    .select()
    .from(verificationTokens)
    .where(
      and(
        eq(verificationTokens.tokenHash, blindIndex(token)),
        eq(verificationTokens.type, 'email_verification'),
        gt(verificationTokens.expiresAt, new Date()),
        isNull(verificationTokens.usedAt)
      )
    )
    .limit(1)

  if (!dbToken) {
    throw new AuthError('INVALID_TOKEN', 'Invalid or expired verification link')
  }

  // Mark token as used
  await db
    .update(verificationTokens)
    .set({ usedAt: new Date() })
    .where(eq(verificationTokens.id, dbToken.id))

  // Mark email as verified
  await db
    .update(users)
    .set({
      emailVerified: true,
      emailVerifiedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(users.email, dbToken.email))
}
