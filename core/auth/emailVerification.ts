import { eq } from 'drizzle-orm'
import { getDb } from '../db/client'
import { users } from '../db/schema/users'
import { verificationTokens } from '../db/schema/verificationTokens'
import { generateRandomToken } from './token'
import { AuthError } from '../errors/types'
import { encrypt } from '../security/encryption'
import { blindIndex } from '../security/blindIndex'
import { claimVerificationToken } from './verificationTokens'

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
    email: emailLower,
    emailEncrypted: encrypt(emailLower),
    type: 'email_verification',
    expiresAt,
  })

  return token
}

export async function verifyEmail(token: string): Promise<void> {
  const db = getDb()

  // Claimed atomically, like every other single-use token here — see
  // claimVerificationToken for why a read-then-write cannot enforce single use.
  const dbToken = await claimVerificationToken(token, 'email_verification')

  if (!dbToken) {
    throw new AuthError('INVALID_TOKEN', 'Invalid or expired verification link')
  }

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
