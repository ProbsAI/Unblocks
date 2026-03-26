import { eq, and, gt, isNull } from 'drizzle-orm'
import { getDb } from '../db/client'
import { users } from '../db/schema/users'
import { verificationTokens } from '../db/schema/verificationTokens'
import { generateRandomToken } from './token'
import { runHook } from '../runtime/hookRunner'
import { AuthError, NotFoundError } from '../errors/types'
import { encrypt } from '../security/encryption'
import { blindIndex } from '../security/blindIndex'
import type { User } from './types'

export async function createMagicLink(email: string): Promise<string> {
  const db = getDb()
  const emailLower = email.toLowerCase()

  // Find or create user
  let [dbUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, emailLower))
    .limit(1)

  if (!dbUser) {
    // Create user without password
    const [newUser] = await db
      .insert(users)
      .values({
        email: emailLower,
        emailEncrypted: encrypt(emailLower),
        emailHash: blindIndex(emailLower),
        emailVerified: false,
      })
      .returning()
    dbUser = newUser

    void runHook('onUserCreated', {
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        avatarUrl: newUser.avatarUrl,
        emailVerified: newUser.emailVerified,
        status: newUser.status,
        createdAt: newUser.createdAt,
        updatedAt: newUser.updatedAt,
      },
      method: 'magic_link',
    })
  }

  // Generate token
  const token = generateRandomToken()
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000) // 15 minutes

  await db.insert(verificationTokens).values({
    token: blindIndex(token),
    tokenHash: blindIndex(token),
    tokenEncrypted: encrypt(token),
    email: emailLower,
    emailEncrypted: encrypt(emailLower),
    type: 'magic_link',
    expiresAt,
  })

  return token
}

export async function verifyMagicLink(token: string): Promise<User> {
  const db = getDb()

  const [dbToken] = await db
    .select()
    .from(verificationTokens)
    .where(
      and(
        eq(verificationTokens.tokenHash, blindIndex(token)),
        eq(verificationTokens.type, 'magic_link'),
        gt(verificationTokens.expiresAt, new Date()),
        isNull(verificationTokens.usedAt)
      )
    )
    .limit(1)

  if (!dbToken) {
    throw new AuthError('INVALID_TOKEN', 'Invalid or expired magic link')
  }

  // Mark token as used
  await db
    .update(verificationTokens)
    .set({ usedAt: new Date() })
    .where(eq(verificationTokens.id, dbToken.id))

  // Get user and mark email as verified
  const [dbUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, dbToken.email))
    .limit(1)

  if (!dbUser) {
    throw new NotFoundError('User')
  }

  if (!dbUser.emailVerified) {
    await db
      .update(users)
      .set({
        emailVerified: true,
        emailVerifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, dbUser.id))
  }

  return {
    id: dbUser.id,
    email: dbUser.email,
    name: dbUser.name,
    avatarUrl: dbUser.avatarUrl,
    emailVerified: true,
    status: dbUser.status,
    createdAt: dbUser.createdAt,
    updatedAt: dbUser.updatedAt,
  }
}
