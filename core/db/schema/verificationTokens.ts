import { pgTable, uuid, varchar, text, timestamp } from 'drizzle-orm/pg-core'

export const verificationTokens = pgTable('verification_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  token: varchar('token', { length: 500 }).notNull().unique(),
  tokenHash: varchar('token_hash', { length: 64 }),
  tokenEncrypted: text('token_encrypted'),
  email: varchar('email', { length: 255 }).notNull(),
  emailEncrypted: text('email_encrypted'),
  type: varchar('type', { length: 50 }).notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
