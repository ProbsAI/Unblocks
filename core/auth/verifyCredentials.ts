import { eq } from 'drizzle-orm'
import { getDb } from '../db/client'
import { users } from '../db/schema/users'
import { verifyPassword } from './password'
import { AuthError } from '../errors/types'
import { loadConfig } from '../runtime/configLoader'
import type { User } from './types'
import { toUser } from './toUser'
import { emailMatches } from '../security/piiStorage'

const GENERIC_ERROR = 'Invalid email or password'

export async function verifyCredentials(
  email: string,
  password: string
): Promise<User> {
  const db = getDb()

  const [dbUser] = await db
    .select()
    .from(users)
    .where(emailMatches(email))
    .limit(1)

  if (!dbUser) {
    throw new AuthError('INVALID_CREDENTIALS', GENERIC_ERROR)
  }

  if (!dbUser.passwordHash) {
    throw new AuthError(
      'INVALID_CREDENTIALS',
      'This account uses a different login method'
    )
  }

  if (dbUser.status !== 'active') {
    throw new AuthError('ACCOUNT_SUSPENDED', 'This account has been suspended')
  }

  // security.requireEmailVerification defaults to true and was enforced
  // nowhere, which is worse than not having the setting: an operator reads it
  // and believes unverified accounts cannot sign in.
  //
  // It is also the enabler for a takeover chain. An attacker registers
  // victim@example.com, never verifies it, and can sign in with their password.
  // When the real owner later arrives via a magic link, that link marks the
  // SAME row verified and signs them into it — with the attacker's password
  // still attached, and the account now passing every verified-account check.
  // Refusing the unverified password sign-in is what breaks the chain.
  if (
    loadConfig('auth').security.requireEmailVerification &&
    !dbUser.emailVerified
  ) {
    throw new AuthError(
      'EMAIL_NOT_VERIFIED',
      'Verify your email address before signing in'
    )
  }

  const valid = await verifyPassword(password, dbUser.passwordHash)
  if (!valid) {
    throw new AuthError('INVALID_CREDENTIALS', GENERIC_ERROR)
  }

  // Update last login
  await db
    .update(users)
    .set({
      lastLoginAt: new Date(),
      loginCount: (dbUser.loginCount ?? 0) + 1,
      updatedAt: new Date(),
    })
    .where(eq(users.id, dbUser.id))

  return toUser(dbUser)
}
