import { readEmail } from '../security/piiStorage'
import type { User } from './types'

/**
 * The columns {@link toUser} needs from a users row.
 *
 * Both email columns are required, and that is the point of declaring this
 * type: which one holds the address depends on `privacy.encryptPii`, so a
 * caller that projects only `email` would silently return '' for every user in
 * encrypted mode. Requiring both makes that a compile error instead.
 */
export interface UserRow {
  id: string
  email: string | null
  emailEncrypted: string | null
  name: string | null
  avatarUrl: string | null
  emailVerified: boolean
  status: string
  createdAt: Date
  updatedAt: Date
}

/**
 * Map a users row to the public User shape.
 *
 * Nine call sites used to build this object by hand, identically. That
 * duplication is what let the email field's handling drift — and it is exactly
 * the surface the storage mode has to change, so it now goes through one
 * function.
 */
export function toUser(row: UserRow): User {
  return {
    id: row.id,
    email: readEmail(row),
    name: row.name,
    avatarUrl: row.avatarUrl,
    emailVerified: row.emailVerified,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}
