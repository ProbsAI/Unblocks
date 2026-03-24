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
  stripeSubscriptionId: varchar('stripe_subscription_id', { length: 255 }),
  stripeSubscriptionIdEncrypted: text('stripe_subscription_id_encrypted'),
  stripePriceId: varchar('stripe_price_id', { length: 255 }),
  plan: varchar('plan', { length: 50 }).default('free').notNull(),
  status: varchar('status', { length: 50 }).default('active').notNull(),
  interval: varchar('interval', { length: 20 }),
  currentPeriodStart: timestamp('current_period_start'),
  currentPeriodEnd: timestamp('current_period_end'),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').default(false).notNull(),
  trialEnd: timestamp('trial_end'),
  metadata: jsonb('metadata').default({}).$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
