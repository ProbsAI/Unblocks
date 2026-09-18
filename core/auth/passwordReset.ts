import { getDb } from '../db/client'
import { users } from '../db/schema/users'
import { verificationTokens } from '../db/schema/verificationTokens'
import { generateRandomToken } from './token'
import { hashPassword } from './password'
import { AuthError } from '../errors/types'
import { blindIndex } from '../security/blindIndex'
import { claimVerificationToken } from './verificationTokens'
import {
  emailMatches,
  emailValueColumns,
  readEmail,
} from '../security/piiStorage'

export async function requestPasswordReset(
  email: string
): Promise<{ token: string; userId: string } | null> {
  const db = getDb()

  const [dbUser] = await db
    .select({
      id: users.id,
      email: users.email,
      emailEncrypted: users.emailEncrypted,
    })
    .from(users)
    .where(emailMatches(email))
    .limit(1)

  // Always return success to prevent email enumeration
  if (!dbUser) return null

  const token = generateRandomToken()
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

  await db.insert(verificationTokens).values({
    token: blindIndex(token),
    tokenHash: blindIndex(token),
    // The token row keeps its own copy. users.email is nullable now, so the
    // address has to come from readEmail rather than the column directly.
    ...emailValueColumns(readEmail(dbUser)),
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
    .where(emailMatches(readEmail(dbToken)))
}
