import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import { sql } from 'drizzle-orm'
import {
  getTestDb,
  truncateAll,
  closeTestDb,
  testDatabaseUrl,
} from '@unblocks/blocks/testing/integration'

/**
 * Which row `getSubscription` picks when a user holds more than one.
 *
 * That became possible deliberately: webhook handling keys on
 * `stripe_subscription_id` rather than the customer, so a second subscription
 * no longer overwrites the first. The cost is that "the" subscription is
 * ambiguous, and the previous `LIMIT 1` with no ORDER BY resolved it in heap
 * order — a cancelled row could shadow a live one, and the answer could change
 * between calls for unchanged data.
 *
 * The rule is: newest row that is not cancelled, else newest row. It depends on
 * Postgres ordering and on which rows exist, so it cannot be checked by a test
 * that stubs the query builder.
 */

beforeAll(() => {
  process.env.DATABASE_URL = testDatabaseUrl()
  process.env.ENCRYPTION_KEY = 'a'.repeat(64)
})

afterAll(async () => {
  await closeTestDb()
})

let userId = ''

beforeEach(async () => {
  await truncateAll()

  const db = getTestDb()
  const [user] = (
    await db.execute(sql`
      INSERT INTO users (email, name, email_verified)
      VALUES ('holder@example.com', 'Holder', true)
      RETURNING id
    `)
  ).rows as Array<{ id: string }>
  userId = user.id
})

async function seedSubscription(
  subscriptionId: string,
  plan: string,
  status: string,
  createdAt: string
): Promise<void> {
  const db = getTestDb()
  await db.execute(sql`
    INSERT INTO subscriptions
      (user_id, stripe_customer_id, stripe_subscription_id, plan, status, created_at)
    VALUES
      (${userId}, 'cus_1', ${subscriptionId}, ${plan}, ${status}, ${createdAt})
  `)
}

describe('getSubscription with several rows for one user', () => {
  it('prefers a live subscription over a cancelled one', async () => {
    const { getSubscription } = await import('./getSubscription')

    // The cancelled row is NEWER, so "just take the newest" would return it and
    // report a paying customer as having no plan.
    await seedSubscription('sub_live', 'business', 'active', '2026-01-01')
    await seedSubscription('sub_old', 'pro', 'canceled', '2026-02-01')

    const result = await getSubscription(userId)

    expect(result?.stripeSubscriptionId).toBe('sub_live')
    expect(result?.plan).toBe('business')
  })

  it('returns the newest when several are live', async () => {
    const { getSubscription } = await import('./getSubscription')

    await seedSubscription('sub_first', 'pro', 'active', '2026-01-01')
    await seedSubscription('sub_second', 'business', 'active', '2026-03-01')

    const result = await getSubscription(userId)

    expect(result?.stripeSubscriptionId).toBe('sub_second')
  })

  it('falls back to the newest cancelled row when nothing is live', async () => {
    const { getSubscription } = await import('./getSubscription')

    // Returning null here would lose the billing history the dashboard shows.
    await seedSubscription('sub_older', 'pro', 'canceled', '2026-01-01')
    await seedSubscription('sub_newer', 'business', 'canceled', '2026-02-01')

    const result = await getSubscription(userId)

    expect(result?.stripeSubscriptionId).toBe('sub_newer')
  })

  it('is stable across calls', async () => {
    const { getSubscription } = await import('./getSubscription')

    await seedSubscription('sub_a', 'pro', 'active', '2026-01-01')
    await seedSubscription('sub_b', 'pro', 'active', '2026-01-02')
    await seedSubscription('sub_c', 'pro', 'canceled', '2026-01-03')

    const first = await getSubscription(userId)
    const second = await getSubscription(userId)

    expect(first?.stripeSubscriptionId).toBe(second?.stripeSubscriptionId)
    expect(first?.stripeSubscriptionId).toBe('sub_b')
  })

  it('returns null when the user has none', async () => {
    const { getSubscription } = await import('./getSubscription')

    expect(await getSubscription(userId)).toBeNull()
  })
})
