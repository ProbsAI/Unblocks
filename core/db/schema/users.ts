import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  jsonb,
} from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  /**
   * The address in the clear — populated only when privacy.encryptPii is false.
   *
   * Nullable because encrypted mode leaves it empty and puts the address in
   * email_encrypted instead. Still UNIQUE: Postgres treats NULLs as distinct,
   * so the unused column holds many NULLs without colliding, and whichever
   * column is in use is the one enforcing uniqueness. See core/security/
   * piiStorage.ts — reads and writes must go through it, never straight at a
   * column, or one mode silently stops working.
   */
  email: varchar('email', { length: 255 }).unique(),
  emailEncrypted: text('email_encrypted'),
  /** Keyed blind index over the address. Populated only in encrypted mode. */
  emailHash: varchar('email_hash', { length: 64 }).unique(),
  passwordHash: varchar('password_hash', { length: 255 }),
  name: varchar('name', { length: 255 }),
  nameEncrypted: text('name_encrypted'),
  avatarUrl: varchar('avatar_url', { length: 500 }),
  emailVerified: boolean('email_verified').default(false).notNull(),
  emailVerifiedAt: timestamp('email_verified_at'),
  lastLoginAt: timestamp('last_login_at'),
  loginCount: integer('login_count').default(0).notNull(),
  status: varchar('status', { length: 20 }).default('active').notNull(),
  metadata: jsonb('metadata').default({}).$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
