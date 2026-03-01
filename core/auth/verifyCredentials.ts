import { eq } from 'drizzle-orm'
import { getDb } from '../db/client'
import { users } from '../db/schema/users'
import { verifyPassword } from './password'
import { AuthError } from '../errors/types'
import type { User } from './types'

const GENERIC_ERROR = 'Invalid email or password'

export async function verifyCredentials(
  email: string,
  password: string
): Promise<User> {
  const db = getDb()

  const [dbUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
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

  return {
    id: dbUser.id,
    email: dbUser.email,
    name: dbUser.name,
    avatarUrl: dbUser.avatarUrl,
    emailVerified: dbUser.emailVerified,
    status: dbUser.status,
    createdAt: dbUser.createdAt,
    updatedAt: dbUser.updatedAt,
  }
}
