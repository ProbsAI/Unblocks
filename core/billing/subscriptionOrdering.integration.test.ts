import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { sql, asc } from 'drizzle-orm'
import {
  getTestDb,
  truncateAll,
  closeTestDb,
  testDatabaseUrl,
} from '@unblocks/blocks/testing/integration'
import {
  buildStripeSubscription,
  stripeEvent,
} from '@unblocks/blocks/testing/stripeFixtures'
import { subscriptions } from '@unblocks/core/db/schema/subscriptions'

/**
 * Delivery ordering and concurrency, against a real Postgres.
 *
 * Event-id idempotency stops a duplicate of the SAME event. Every case here
 * involves two genuinely different events, which the ledger lets through:
 *
 *   - A late older snapshot must not roll plan or status back.
 *   - Two first-time events for one customer must not both claim the same
 *     placeholder row, which would lose a paid subscription.
 *   - An older event losing the insert race must not win the conflict update.
 *   - A deletion that overtakes its creation must leave a tombstone, or the
 *     late create restores entitlement the provider already revoked.
 *
 * Every one of these is a property of concurrent SQL, so they need a real
 * database. Which row an event targets lives in
 * subscriptionRouting.integration.test.ts.
 */

let knownUserId = ''

const NOW = Math.floor(Date.now() / 1000)

function buildSubscription(
  overrides: Record<string, unknown> = {},
  planId: string | null = 'pro',
  priceId = 'price_test_1'
): Record<string, unknown> {
  return buildStripeSubscription(overrides, planId, priceId, NOW)
}
function event(
  type: string,
  object: Record<string, unknown>,
  id: string,
  created = NOW
): string {
  return stripeEvent(type, object, id, created)
}

const hookCalls: Array<{ name: string; args: unknown }> = []

vi.mock('../runtime/hookRunner', () => ({
  runHook: vi.fn(async (name: string, args: unknown) => {
    hookCalls.push({ name, args })
  }),
}))

const stripeMock = {
  webhooks: {
    constructEvent: vi.fn((payload: string) => JSON.parse(payload)),
  },
  customers: {
    retrieve: vi.fn(async (id: string) => ({
      id,
      deleted: false,
      metadata: { userId: knownUserId } as Record<string, string>,
    })),
  },
  subscriptions: {
    retrieve: vi.fn(async (id: string) => buildSubscription({ id })),
  },
}

vi.mock('./customer', () => ({
  getStripe: () => stripeMock,
}))

beforeAll(() => {
  process.env.DATABASE_URL = testDatabaseUrl()
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'
  process.env.ENCRYPTION_KEY = 'a'.repeat(64)
})

afterAll(async () => {
  await closeTestDb()
})

beforeEach(async () => {
  await truncateAll()
  hookCalls.length = 0
  vi.clearAllMocks()

  const db = getTestDb()
  const [user] = (
    await db.execute(sql`
      INSERT INTO users (email, name, email_verified)
      VALUES ('payer@example.com', 'Payer', true)
      RETURNING id
    `)
  ).rows as Array<{ id: string }>
  knownUserId = user.id
})

async function rows(): Promise<Array<typeof subscriptions.$inferSelect>> {
  const db = getTestDb()
  return db.select().from(subscriptions).orderBy(asc(subscriptions.createdAt))
}

describe('out-of-order delivery', () => {
  it('does not let an older snapshot roll the subscription back', async () => {
    const { handleStripeWebhook } = await import('./handleWebhook')

    await handleStripeWebhook(
      event(
        'customer.subscription.created',
        buildSubscription({}, 'business'),
        'evt_new',
        NOW
      ),
      'sig'
    )

    // A genuinely different event, so the idempotency ledger lets it through —
    // ordering is a separate problem from duplication, and only the event's
    // own timestamp can distinguish them.
    await handleStripeWebhook(
      event(
        'customer.subscription.updated',
        buildSubscription({ status: 'canceled' }, 'pro'),
        'evt_old',
        NOW - 600
      ),
      'sig'
    )

    const all = await rows()
    expect(all[0].plan).toBe('business')
    expect(all[0].status).toBe('active')
  })

  it('still applies a newer snapshot', async () => {
    const { handleStripeWebhook } = await import('./handleWebhook')

    await handleStripeWebhook(
      event(
        'customer.subscription.created',
        buildSubscription({}, 'pro'),
        'evt_first',
        NOW - 600
      ),
      'sig'
    )
    await handleStripeWebhook(
      event(
        'customer.subscription.updated',
        buildSubscription({}, 'business'),
        'evt_second',
        NOW
      ),
      'sig'
    )

    const all = await rows()
    expect(all[0].plan).toBe('business')
  })

  it('does not let an old deletion cancel a resubscription', async () => {
    const { handleStripeWebhook } = await import('./handleWebhook')

    await handleStripeWebhook(
      event(
        'customer.subscription.updated',
        buildSubscription({}, 'business'),
        'evt_current',
        NOW
      ),
      'sig'
    )

    await handleStripeWebhook(
      event(
        'customer.subscription.deleted',
        buildSubscription({}),
        'evt_stale_delete',
        NOW - 600
      ),
      'sig'
    )

    const all = await rows()
    expect(all[0].status).toBe('active')
    expect(all[0].plan).toBe('business')
  })
})

describe('races and late deliveries', () => {
  it('does not lose a subscription when two first-time events share a placeholder', async () => {
    // getOrCreateCustomer leaves one row with the customer linked and nothing
    // subscribed. Two first-time events both see it; if both write to it, one
    // paid subscription silently disappears.
    const db = getTestDb()
    await db.execute(sql`
      INSERT INTO subscriptions (user_id, stripe_customer_id, plan, status)
      VALUES (${knownUserId}, 'cus_1', 'free', 'active')
    `)

    const { handleStripeWebhook } = await import('./handleWebhook')

    await handleStripeWebhook(
      event('customer.subscription.created', buildSubscription(), 'evt_a'),
      'sig'
    )
    await handleStripeWebhook(
      event(
        'customer.subscription.created',
        buildSubscription({ id: 'sub_b' }, 'business'),
        'evt_b'
      ),
      'sig'
    )

    const all = await rows()
    expect(all).toHaveLength(2)
    expect(all.map((r) => r.stripeSubscriptionId).sort()).toEqual([
      'sub_a',
      'sub_b',
    ])
  })

  it('does not let an older event win the insert conflict', async () => {
    // Both events miss the lookup and race to provision the same subscription.
    // The newer lands first; the older then takes the conflict path, which
    // must be stale-guarded exactly like the ordinary update path.
    const { handleStripeWebhook } = await import('./handleWebhook')

    await handleStripeWebhook(
      event(
        'customer.subscription.created',
        buildSubscription({}, 'business'),
        'evt_new',
        NOW
      ),
      'sig'
    )
    await handleStripeWebhook(
      event(
        'customer.subscription.created',
        buildSubscription({ status: 'canceled' }, 'pro'),
        'evt_old',
        NOW - 600
      ),
      'sig'
    )

    const all = await rows()
    expect(all).toHaveLength(1)
    expect(all[0].plan).toBe('business')
    expect(all[0].status).toBe('active')
  })

  it('leaves a tombstone when a deletion overtakes the creation', async () => {
    const { handleStripeWebhook } = await import('./handleWebhook')

    // Deletion arrives with no row to cancel.
    await handleStripeWebhook(
      event(
        'customer.subscription.deleted',
        buildSubscription(),
        'evt_delete',
        NOW
      ),
      'sig'
    )

    let all = await rows()
    expect(all).toHaveLength(1)
    expect(all[0].status).toBe('canceled')

    // The create it overtook now lands. Without the tombstone there would be
    // no last_event_at to compare against, so this would insert an ACTIVE
    // subscription and restore entitlement the provider already revoked.
    await handleStripeWebhook(
      event(
        'customer.subscription.created',
        buildSubscription({}, 'business'),
        'evt_create',
        NOW - 600
      ),
      'sig'
    )

    all = await rows()
    expect(all).toHaveLength(1)
    expect(all[0].status).toBe('canceled')
    expect(all[0].plan).toBe('free')
  })
})
