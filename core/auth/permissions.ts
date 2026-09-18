import { eq } from 'drizzle-orm'
import { getDb } from '../db/client'
import { users } from '../db/schema/users'
import type { User } from './types'
import { toUser } from './toUser'
import { emailMatches } from '../security/piiStorage'

export async function getUserById(userId: string): Promise<User | null> {
  const db = getDb()

  const [dbUser] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!dbUser) return null

  return toUser(dbUser)
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const db = getDb()

  const [dbUser] = await db
    .select()
    .from(users)
    .where(emailMatches(email))
    .limit(1)

  if (!dbUser) return null

  return toUser(dbUser)
}
