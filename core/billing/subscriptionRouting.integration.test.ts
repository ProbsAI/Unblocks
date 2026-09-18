import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { sql, eq, asc } from 'drizzle-orm'
import {
  getTestDb,
  truncateAll,
  closeTestDb,
  testDatabaseUrl,
  seedUser,
} from '@unblocks/blocks/testing/integration'
import {
  buildStripeSubscription,
  stripeEvent,
} from '@unblocks/blocks/testing/stripeFixtures'
import { subscriptions } from '@unblocks/core/db/schema/subscriptions'

/**
 * Which row a Stripe event lands on, against a real Postgres.
 *
 * The handler used to key every subscription lookup on the CUSTOMER id. That is
 * wrong whenever a customer holds more than one subscription, and it failed in
 * two directions: an update for a second subscription overwrote the row holding
 * the first, and a deletion cancelled every subscription the customer had.
 *
 * Also covered: plan resolution, where an unrecognised price must not silently
 * grant a paid tier and the plan the buyer actually selected beats a price
 * lookup.
 *
 * All of it depends on which rows a WHERE clause selects, which is exactly what
 * a suite mocking the query builder cannot see. Ordering and concurrency live
 * in subscriptionOrdering.integration.test.ts.
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

  knownUserId = await seedUser({ email: 'payer@example.com', name: 'Payer' })
})

async function rows(): Promise<Array<typeof subscriptions.$inferSelect>> {
  const db = getTestDb()
  return db.select().from(subscriptions).orderBy(asc(subscriptions.createdAt))
}

describe('one customer, several subscriptions', () => {
  it('gives a second subscription its own row instead of overwriting the first', async () => {
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

  it('cancels only the subscription named in the deletion', async () => {
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

    await handleStripeWebhook(
      event(
        'customer.subscription.deleted',
        buildSubscription({ id: 'sub_a' }),
        'evt_del'
      ),
      'sig'
    )

    const db = getTestDb()
    const [gone] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.stripeSubscriptionId, 'sub_a'))
    const [kept] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.stripeSubscriptionId, 'sub_b'))

    expect(gone.status).toBe('canceled')
    expect(gone.plan).toBe('free')

    // The bug: filtering the cancellation by customer took this row with it,
    // silently revoking a subscription the customer still pays for.
    expect(kept.status).toBe('active')
    expect(kept.plan).toBe('business')
  })

  it('adopts the placeholder row rather than creating a duplicate', async () => {
    // getOrCreateCustomer writes a row with the customer linked and nothing
    // subscribed. First provisioning must fill it in, not sit alongside it.
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

    const all = await rows()
    expect(all).toHaveLength(1)
    expect(all[0].stripeSubscriptionId).toBe('sub_a')
    expect(all[0].plan).toBe('pro')
  })
})

describe('plan resolution', () => {
  it('refuses to guess a plan for an unrecognised price', async () => {
    const { handleStripeWebhook } = await import('./handleWebhook')

    // The old fallback was "first paid plan, else pro", so a price nobody had
    // configured silently granted a paid tier. Throwing returns a non-2xx, so
    // Stripe retries and the misconfiguration surfaces instead of being
    // papered over with an entitlement.
    await expect(
      handleStripeWebhook(
        event(
          'customer.subscription.created',
          buildSubscription({}, null, 'price_not_configured'),
          'evt_a'
        ),
        'sig'
      )
    ).rejects.toThrow(/configured plan/i)

    expect(await rows()).toHaveLength(0)
  })

  it('ignores a plan id that names no configured plan', async () => {
    const { handleStripeWebhook } = await import('./handleWebhook')

    // price.metadata.planId is an operator-supplied string. A stale or mistyped
    // one must not create an entitlement to a plan that does not exist.
    await expect(
      handleStripeWebhook(
        event(
          'customer.subscription.created',
          buildSubscription({}, 'enterprise-that-was-removed', 'price_nope'),
          'evt_a'
        ),
        'sig'
      )
    ).rejects.toThrow(/configured plan/i)
  })

  it('prefers the plan the buyer selected over a price lookup', async () => {
    const { handleStripeWebhook } = await import('./handleWebhook')

    stripeMock.subscriptions.retrieve.mockResolvedValueOnce(
      // price_xxx resolves to Pro through the configured mapping.
      buildSubscription({ id: 'sub_a' }, null, 'price_xxx')
    )

    await handleStripeWebhook(
      event(
        'checkout.session.completed',
        {
          subscription: 'sub_a',
          customer: 'cus_1',
          client_reference_id: knownUserId,
          metadata: { planId: 'business' },
        },
        'evt_checkout'
      ),
      'sig'
    )

    const all = await rows()
    // The Checkout Session metadata records what the user actually clicked, so
    // it outranks a price lookup — which is ambiguous whenever two plans share
    // a price id, as the shipped placeholders once did.
    expect(all[0].plan).toBe('business')
  })
})
