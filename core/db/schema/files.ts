import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  jsonb,
  timestamp,
} from 'drizzle-orm/pg-core'
import { users } from './users'
import { teams } from './teams'

export const files = pgTable('files', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  teamId: uuid('team_id').references(() => teams.id, { onDelete: 'set null' }),
  filename: varchar('filename', { length: 255 }).notNull(),
  filenameEncrypted: text('filename_encrypted'),
  originalName: varchar('original_name', { length: 255 }).notNull(),
  originalNameEncrypted: text('original_name_encrypted'),
  mimeType: varchar('mime_type', { length: 127 }).notNull(),
  size: integer('size').notNull(),
  storageKey: varchar('storage_key', { length: 512 }).notNull(),
  storageKeyEncrypted: text('storage_key_encrypted'),
  url: text('url'),
  thumbnailUrl: text('thumbnail_url'),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
