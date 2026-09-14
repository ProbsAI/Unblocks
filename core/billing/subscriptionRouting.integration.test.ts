import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { sql, eq, asc } from 'drizzle-orm'
import {
  getTestDb,
  truncateAll,
  closeTestDb,
  testDatabaseUrl,
} from '@unblocks/blocks/testing/integration'
import { subscriptions } from '@unblocks/core/db/schema/subscriptions'

/**
 * Which row a Stripe event lands on, against a real Postgres.
 *
 * The handler used to key every subscription lookup on the CUSTOMER id. That is
 * wrong whenever a customer holds more than one subscription, and it fails in
 * two directions:
 *
 *   - An update for a second subscription overwrote the row holding the first.
 *   - A deletion cancelled every subscription the customer had, so an
 *     out-of-order deletion of an old subscription revoked entitlement for the
 *     current one.
 *
 * Also covered: plan resolution (an unrecognised price must not silently grant
 * a paid tier, and the plan the buyer actually selected beats a price lookup)
 * and delivery ordering (Stripe does not promise it, so a late older snapshot
 * must not roll a subscription back).
 *
 * Every one of these depends on which rows a WHERE clause selects, which is
 * exactly what a suite mocking the query builder cannot see.
 */

const hookCalls: Array<{ name: string; args: unknown }> = []

vi.mock('../runtime/hookRunner', () => ({
  runHook: vi.fn(async (name: string, args: unknown) => {
    hookCalls.push({ name, args })
  }),
}))

let knownUserId = ''

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

const NOW = Math.floor(Date.now() / 1000)

function buildSubscription(
  overrides: Record<string, unknown> = {},
  planId: string | null = 'pro',
  priceId = 'price_test_1'
): Record<string, unknown> {
  return {
    id: 'sub_a',
    customer: 'cus_1',
    status: 'active',
    cancel_at_period_end: false,
    trial_end: null,
    items: {
      data: [
        {
          price: {
            id: priceId,
            metadata: planId ? { planId } : {},
            recurring: { interval: 'month' },
          },
          current_period_start: NOW,
          current_period_end: NOW + 30 * 24 * 3600,
        },
      ],
    },
    ...overrides,
  }
}

function event(
  type: string,
  object: Record<string, unknown>,
  id: string,
  created = NOW
): string {
  return JSON.stringify({ id, type, created, data: { object } })
}

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
