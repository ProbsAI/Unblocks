import {
  pgTable,
  uuid,
  varchar,
  jsonb,
  timestamp,
} from 'drizzle-orm/pg-core'
import { users } from './users'
import { teams } from './teams'

export const apiKeys = pgTable('api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  teamId: uuid('team_id').references(() => teams.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  /** Visible prefix for identification (e.g., "ub_live_a3f8b2c1") */
  prefix: varchar('prefix', { length: 20 }).notNull(),
  /**
   * HMAC-SHA256 blind index of the full key, used for lookup.
   *
   * This is the ONLY stored derivation of the key and it is one-way: the key is
   * shown once at creation and is unrecoverable afterwards. Do not add a
   * reversible copy — validation only ever needs the blind index, so storing
   * decryptable keys would create a credential dump with no benefit.
   */
  keyHash: varchar('key_hash', { length: 64 }).notNull().unique(),
  /** Allowed scopes (e.g., ["ai:read", "ai:write", "teams:read"]) */
  scopes: jsonb('scopes').notNull().default(['*']),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
