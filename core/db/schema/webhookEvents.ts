import { pgTable, varchar, timestamp } from 'drizzle-orm/pg-core'

/**
 * Idempotency ledger for inbound provider webhooks.
 *
 * Stripe delivers every event at least once and retries whenever the endpoint
 * does not return 2xx, so each handler must be safe to run more than once.
 * A row here means the event has already been applied and must not be applied
 * a second time. The event id is the primary key, which makes the insert itself
 * the concurrency control: two concurrent deliveries race on the same key and
 * exactly one wins.
 */
export const webhookEvents = pgTable('webhook_events', {
  eventId: varchar('event_id', { length: 255 }).primaryKey(),
  provider: varchar('provider', { length: 50 }).notNull(),
  type: varchar('type', { length: 100 }).notNull(),
  processedAt: timestamp('processed_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})
