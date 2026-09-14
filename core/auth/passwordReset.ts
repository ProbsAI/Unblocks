import { eq } from 'drizzle-orm'
import { getDb } from '../db/client'
import { users } from '../db/schema/users'
import { verificationTokens } from '../db/schema/verificationTokens'
import { generateRandomToken } from './token'
import { hashPassword } from './password'
import { AuthError } from '../errors/types'
import { encrypt } from '../security/encryption'
import { blindIndex } from '../security/blindIndex'
import { claimVerificationToken } from './verificationTokens'

export async function requestPasswordReset(
  email: string
): Promise<{ token: string; userId: string } | null> {
  const db = getDb()

  const [dbUser] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1)

  // Always return success to prevent email enumeration
  if (!dbUser) return null

  const token = generateRandomToken()
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

  await db.insert(verificationTokens).values({
    token: blindIndex(token),
    tokenHash: blindIndex(token),
    email: dbUser.email,
    emailEncrypted: encrypt(dbUser.email),
    type: 'password_reset',
    expiresAt,
  })

  return { token, userId: dbUser.id }
}

export async function resetPassword(
  token: string,
  newPassword: string
): Promise<void> {
  const db = getDb()

  // Claimed atomically: two concurrent requests reading the row both saw an
  // unused token and both reset the password, from one emailed link.
  const dbToken = await claimVerificationToken(token, 'password_reset')

  if (!dbToken) {
    throw new AuthError('INVALID_TOKEN', 'Invalid or expired reset link')
  }

  // Update password
  const passwordHash = await hashPassword(newPassword)
  await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.email, dbToken.email))
}
