import { eq, and, gt, isNull } from 'drizzle-orm'
import { getDb } from '../db/client'
import { users } from '../db/schema/users'
import { verificationTokens } from '../db/schema/verificationTokens'
import { generateRandomToken } from './token'
import { hashPassword } from './password'
import { AuthError } from '../errors/types'
import { encrypt } from '../security/encryption'
import { blindIndex } from '../security/blindIndex'

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
    tokenEncrypted: encrypt(token),
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

  const [dbToken] = await db
    .select()
    .from(verificationTokens)
    .where(
      and(
        eq(verificationTokens.tokenHash, blindIndex(token)),
        eq(verificationTokens.type, 'password_reset'),
        gt(verificationTokens.expiresAt, new Date()),
        isNull(verificationTokens.usedAt)
      )
    )
    .limit(1)

  if (!dbToken) {
    throw new AuthError('INVALID_TOKEN', 'Invalid or expired reset link')
  }

  // Mark token as used
  await db
    .update(verificationTokens)
    .set({ usedAt: new Date() })
    .where(eq(verificationTokens.id, dbToken.id))

  // Update password
  const passwordHash = await hashPassword(newPassword)
  await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.email, dbToken.email))
}
