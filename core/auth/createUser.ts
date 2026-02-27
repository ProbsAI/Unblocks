import { eq } from 'drizzle-orm'
import { getDb } from '../db/client'
import { users } from '../db/schema/users'
import { hashPassword } from './password'
import { runHook } from '../runtime/hookRunner'
import { ConflictError, ValidationError } from '../errors/types'
import type { CreateUserInput, User } from './types'

export async function createUser(input: CreateUserInput): Promise<User> {
  const db = getDb()

  // Check if email already exists
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, input.email.toLowerCase()))
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
      email: input.email.toLowerCase(),
      passwordHash,
      name: input.name ?? null,
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

  // Fire hook asynchronously
  const method = input.password ? 'email' : 'oauth'
  void runHook('onUserCreated', { user, method })

  return user
}
