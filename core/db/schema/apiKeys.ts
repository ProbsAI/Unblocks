import {
  pgTable,
  uuid,
  varchar,
  text,
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
  /** HMAC-SHA256 blind index of the full key for lookup */
  keyHash: varchar('key_hash', { length: 64 }).notNull().unique(),
  /** AES-256-GCM encrypted full key */
  keyEncrypted: text('key_encrypted').notNull(),
  /** Allowed scopes (e.g., ["ai:read", "ai:write", "teams:read"]) */
  scopes: jsonb('scopes').notNull().default(['*']),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
