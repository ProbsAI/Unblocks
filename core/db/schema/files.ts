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
  // No *_encrypted twin for these. Each one was written beside the plaintext
  // column it duplicates and read by nothing, so it protected an attacker from
  // having to glance one column to the left. Filenames are also not in the tier
  // that justifies field encryption — the file's own contents are not
  // encrypted, and they are the more sensitive thing.
  filename: varchar('filename', { length: 255 }).notNull(),
  originalName: varchar('original_name', { length: 255 }).notNull(),
  mimeType: varchar('mime_type', { length: 127 }).notNull(),
  size: integer('size').notNull(),
  storageKey: varchar('storage_key', { length: 512 }).notNull(),
  url: text('url'),
  thumbnailUrl: text('thumbnail_url'),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
