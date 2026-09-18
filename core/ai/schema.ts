import {
  pgTable,
  uuid,
  varchar,
  integer,
  jsonb,
  text,
  timestamp,
  index,
} from 'drizzle-orm/pg-core'
import { users } from '../db/schema/users'

export const aiUsage = pgTable('ai_usage', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  model: varchar('model', { length: 100 }).notNull(),
  provider: varchar('provider', { length: 50 }).notNull(),
  promptTokens: integer('prompt_tokens').notNull().default(0),
  completionTokens: integer('completion_tokens').notNull().default(0),
  totalTokens: integer('total_tokens').notNull().default(0),
  costCents: integer('cost_cents').notNull().default(0),
  latencyMs: integer('latency_ms').notNull().default(0),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  // Both usage queries filter by user and order by time, and this table grows
  // by a row per completion. Without a composite index they degrade into a
  // full scan plus sort of every row ever written, on a per-request path.
  index('ai_usage_user_created_idx').on(table.userId, table.createdAt),
])

export const promptTemplates = pgTable('prompt_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description').default(''),
  template: text('template').notNull(),
  variables: jsonb('variables').default([]),
  model: varchar('model', { length: 100 }).notNull(),
  temperature: integer('temperature'),
  maxTokens: integer('max_tokens'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
