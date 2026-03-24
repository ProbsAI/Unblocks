import { eq } from 'drizzle-orm'
import { getDb } from '../db/client'
import { users } from '../db/schema/users'
import { hashPassword } from './password'
import { runHook } from '../runtime/hookRunner'
import { ConflictError, ValidationError } from '../errors/types'
import { encrypt, encryptNullable } from '../security/encryption'
import { blindIndex } from '../security/blindIndex'
import type { CreateUserInput, User } from './types'

export async function createUser(input: CreateUserInput): Promise<User> {
  const db = getDb()
  const emailLower = input.email.toLowerCase()

  // Check if email already exists
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, emailLower))
    .limit(1)

  if (existing.length > 0) {
    throw new ConflictError('An account with this email already exists')
  }

  // Hash password if provided
  let passwordHash: string | null = null
  if (input.password) {
    if (input.password.length < 8) {
      throw new ValidationError('Password must be at least 8 characters')
    }
    passwordHash = await hashPassword(input.password)
  }

  const [dbUser] = await db
    .insert(users)
    .values({
      email: emailLower,
      emailEncrypted: encrypt(emailLower),
      emailHash: blindIndex(emailLower),
      passwordHash,
      name: input.name ?? null,
      nameEncrypted: encryptNullable(input.name ?? null),
      avatarUrl: input.avatarUrl ?? null,
      emailVerified: input.emailVerified ?? false,
    })
    .returning()

  const user: User = {
    id: dbUser.id,
    email: dbUser.email,
    name: dbUser.name,
    avatarUrl: dbUser.avatarUrl,
    emailVerified: dbUser.emailVerified,
    status: dbUser.status,
    createdAt: dbUser.createdAt,
    updatedAt: dbUser.updatedAt,
  }

  // Fire hook before returning
  const method = input.password ? 'email' : 'oauth'
  await runHook('onUserCreated', { user, method })

  return user
}
