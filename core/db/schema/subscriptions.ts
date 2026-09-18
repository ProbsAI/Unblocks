import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  jsonb,
} from 'drizzle-orm/pg-core'
import { users } from './users'

export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
  stripeCustomerIdEncrypted: text('stripe_customer_id_encrypted'),
  // Unique so two concurrent deliveries for the same Stripe subscription cannot
  // both miss the lookup and both insert. Event-id idempotency does not help
  // there: the two events have different ids, so both pass the ledger gate.
  // NULLs stay distinct in Postgres, so the placeholder row getOrCreateCustomer
  // writes (customer linked, nothing subscribed yet) is unaffected.
  stripeSubscriptionId: varchar('stripe_subscription_id', {
    length: 255,
  }).unique(),
  stripeSubscriptionIdEncrypted: text('stripe_subscription_id_encrypted'),
  stripePriceId: varchar('stripe_price_id', { length: 255 }),
  plan: varchar('plan', { length: 50 }).default('free').notNull(),
  status: varchar('status', { length: 50 }).default('active').notNull(),
  interval: varchar('interval', { length: 20 }),
  currentPeriodStart: timestamp('current_period_start'),
  currentPeriodEnd: timestamp('current_period_end'),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').default(false).notNull(),
  trialEnd: timestamp('trial_end'),
  /**
   * Creation time of the last provider event applied to this row.
   *
   * Stripe does not guarantee delivery order, so an older
   * customer.subscription.updated snapshot can arrive after a newer one and
   * roll plan/status back to stale values. Event-id idempotency cannot catch
   * that — the stale event is a genuinely different event. Writes compare
   * against this and skip anything older.
   */
  lastEventAt: timestamp('last_event_at'),
  metadata: jsonb('metadata').default({}).$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
