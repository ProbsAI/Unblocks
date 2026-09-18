import { pgTable, uuid, varchar, text, timestamp } from 'drizzle-orm/pg-core'

export const verificationTokens = pgTable('verification_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  token: varchar('token', { length: 500 }).notNull().unique(),
  tokenHash: varchar('token_hash', { length: 64 }),
  // Nullable in both directions: encrypted mode leaves `email` NULL and puts
  // the address in `email_encrypted`, plaintext mode does the reverse. Read it
  // with readEmail(), never off the column. No blind index — this table is only
  // ever found by token_hash. See core/security/piiStorage.ts.
  email: varchar('email', { length: 255 }),
  emailEncrypted: text('email_encrypted'),
  type: varchar('type', { length: 50 }).notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
