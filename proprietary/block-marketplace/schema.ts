import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  jsonb,
  timestamp,
  real,
} from 'drizzle-orm/pg-core'
import { users } from '../../core/db/schema/users'

export const sellerProfiles = pgTable('seller_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  displayName: varchar('display_name', { length: 100 }).notNull(),
  bio: text('bio').default(''),
  avatarUrl: text('avatar_url'),
  rating: real('rating').notNull().default(0),
  totalSales: integer('total_sales').notNull().default(0),
  totalRevenue: integer('total_revenue').notNull().default(0),
  verified: boolean('verified').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const listings = pgTable('listings', {
  id: uuid('id').primaryKey().defaultRandom(),
  sellerId: uuid('seller_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description').notNull(),
  type: varchar('type', { length: 50 }).notNull().default('product'),
  price: integer('price').notNull(),
  currency: varchar('currency', { length: 10 }).notNull().default('usd'),
  images: jsonb('images').default([]),
  category: varchar('category', { length: 100 }).notNull(),
  tags: jsonb('tags').default([]),
  status: varchar('status', { length: 20 }).notNull().default('draft'),
  metadata: jsonb('metadata').default({}),
  viewCount: integer('view_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const orders = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  buyerId: uuid('buyer_id').notNull().references(() => users.id),
  sellerId: uuid('seller_id').notNull().references(() => users.id),
  listingId: uuid('listing_id').notNull().references(() => listings.id),
  quantity: integer('quantity').notNull().default(1),
  totalPrice: integer('total_price').notNull(),
  currency: varchar('currency', { length: 10 }).notNull().default('usd'),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  shippingAddress: jsonb('shipping_address'),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const reviews = pgTable('reviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  listingId: uuid('listing_id').notNull().references(() => listings.id),
  reviewerId: uuid('reviewer_id').notNull().references(() => users.id),
  sellerId: uuid('seller_id').notNull().references(() => users.id),
  rating: integer('rating').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  body: text('body').default(''),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
