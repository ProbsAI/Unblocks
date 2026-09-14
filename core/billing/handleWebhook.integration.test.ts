import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { sql, eq } from 'drizzle-orm'
import {
  getTestDb,
  truncateAll,
  closeTestDb,
  testDatabaseUrl,
} from '@unblocks/blocks/testing/integration'
import { subscriptions } from '@unblocks/core/db/schema/subscriptions'

/**
 * Regression tests for Stripe webhook handling, against a real Postgres.
 *
 * These cover the two failure modes that would have cost real money:
 *
 *  1. No idempotency. Stripe retries on any non-2xx, so a duplicate delivery
 *     re-applied plan changes and re-fired payment hooks.
 *  2. handleSubscriptionUpdate was `if (existing) { update }` with no else, so
 *     a first-time subscriber with no local row had their event silently
 *     dropped — they paid and received no entitlement.
 *
 * The mocked suite could not see either: it stubbed constructEvent (so
 * signature verification never ran) and pre-seeded every lookup with a row (so
 * the missing-row branch was unreachable).
 *
 * Only the Stripe SDK is faked here — the database is real.
 */

const hookCalls: Array<{ name: string; args: unknown }> = []

vi.mock('../runtime/hookRunner', () => ({
  runHook: vi.fn(async (name: string, args: unknown) => {
    hookCalls.push({ name, args })
  }),
}))

const stripeMock = {
  webhooks: {
    // Payload is the already-parsed event; signature checking is a Stripe
    // concern and is covered separately by a unit test.
    constructEvent: vi.fn((payload: string) => JSON.parse(payload)),
  },
  customers: {
    // metadata is widened to Record<string, string> so a test can override it
    // with {} to simulate a customer that carries no user link.
    retrieve: vi.fn(
      async (
        id: string
      ): Promise<{
        id: string
        deleted: boolean
        metadata: Record<string, string>
      }> => ({
        id,
        deleted: false,
        metadata: { userId: knownUserId },
      })
    ),
  },
  subscriptions: {
    retrieve: vi.fn(async (id: string) => buildSubscription({ id })),
  },
}

vi.mock('./customer', () => ({
  getStripe: () => stripeMock,
}))

let knownUserId = ''

beforeAll(() => {
  process.env.DATABASE_URL = testDatabaseUrl()
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'
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

function buildSubscription(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  const now = Math.floor(Date.now() / 1000)
  return {
    id: 'sub_test_1',
    customer: 'cus_test_1',
    status: 'active',
    cancel_at_period_end: false,
    trial_end: null,
    current_period_start: now,
    current_period_end: now + 30 * 24 * 3600,
    items: {
      data: [
        {
          price: {
            id: 'price_test_1',
            metadata: { planId: 'pro' },
            recurring: { interval: 'month' },
          },
          current_period_start: now,
          current_period_end: now + 30 * 24 * 3600,
        },
      ],
    },
    ...overrides,
  }
}

function event(
  type: string,
  object: Record<string, unknown>,
  id = 'evt_1'
): string {
  return JSON.stringify({ id, type, data: { object } })
}

describe('handleStripeWebhook — provisioning a first-time subscriber', () => {
  it('creates a subscription row when none exists rather than dropping the event', async () => {
    const db = getTestDb()
    const { handleStripeWebhook } = await import('./handleWebhook')

    await handleStripeWebhook(
      event('customer.subscription.created', buildSubscription()),
      'sig'
    )

    const rows = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.stripeCustomerId, 'cus_test_1'))

    expect(rows).toHaveLength(1)
    expect(rows[0].userId).toBe(knownUserId)
    expect(rows[0].plan).toBe('pro')
    expect(rows[0].status).toBe('active')
  })

  it('throws rather than silently dropping when the customer cannot be linked', async () => {
    stripeMock.customers.retrieve.mockResolvedValueOnce({
      id: 'cus_orphan',
      deleted: false,
      metadata: {},
    })

    const { handleStripeWebhook } = await import('./handleWebhook')

    // Throwing produces a non-2xx so Stripe retries. Swallowing it would lose
    // a paid subscription permanently.
    await expect(
      handleStripeWebhook(
        event(
          'customer.subscription.created',
          buildSubscription({ customer: 'cus_orphan' })
        ),
        'sig'
      )
    ).rejects.toThrow(/cannot link/i)
  })

  it('provisions on checkout.session.completed', async () => {
    const db = getTestDb()
    const { handleStripeWebhook } = await import('./handleWebhook')

    await handleStripeWebhook(
      event('checkout.session.completed', {
        subscription: 'sub_test_1',
        customer: 'cus_test_1',
        client_reference_id: knownUserId,
      }),
      'sig'
    )

    const rows = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.stripeCustomerId, 'cus_test_1'))

    expect(rows).toHaveLength(1)
    expect(rows[0].userId).toBe(knownUserId)
  })
})

describe('handleStripeWebhook — idempotency', () => {
  it('applies a duplicate delivery of the same event only once', async () => {
    const db = getTestDb()
    const { handleStripeWebhook } = await import('./handleWebhook')

    const payload = event(
      'customer.subscription.created',
      buildSubscription(),
      'evt_duplicate'
    )

    await handleStripeWebhook(payload, 'sig')
    await handleStripeWebhook(payload, 'sig')

    const rows = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.stripeCustomerId, 'cus_test_1'))

    // A second application would have inserted a duplicate row.
    expect(rows).toHaveLength(1)
  })

  it('does not re-fire payment hooks on redelivery', async () => {
    const { handleStripeWebhook } = await import('./handleWebhook')

    const payload = event(
      'invoice.payment_succeeded',
      {
        customer: 'cus_test_1',
        amount_paid: 2900,
        hosted_invoice_url: 'https://stripe.test/i/1',
        lines: { data: [{ price: { id: 'price_test_1' } }] },
      },
      'evt_invoice_1'
    )

    await handleStripeWebhook(payload, 'sig')
    await handleStripeWebhook(payload, 'sig')

    const paymentHooks = hookCalls.filter(
      (c) => c.name === 'onPaymentSucceeded'
    )
    expect(paymentHooks).toHaveLength(1)
  })

  it('still processes a genuinely different event', async () => {
    const { handleStripeWebhook } = await import('./handleWebhook')

    await handleStripeWebhook(
      event('customer.subscription.created', buildSubscription(), 'evt_a'),
      'sig'
    )
    await handleStripeWebhook(
      event(
        'customer.subscription.updated',
        buildSubscription({ status: 'past_due' }),
        'evt_b'
      ),
      'sig'
    )

    const db = getTestDb()
    const rows = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.stripeCustomerId, 'cus_test_1'))

    expect(rows).toHaveLength(1)
    expect(rows[0].status).toBe('past_due')
  })
})

describe('handleStripeWebhook — payment hooks resolve the user', () => {
  it('passes a real userId rather than an empty string', async () => {
    const { handleStripeWebhook } = await import('./handleWebhook')

    await handleStripeWebhook(
      event(
        'invoice.payment_succeeded',
        {
          customer: 'cus_test_1',
          amount_paid: 2900,
          hosted_invoice_url: null,
          lines: { data: [{ price: { id: 'price_test_1' } }] },
        },
        'evt_invoice_userid'
      ),
      'sig'
    )

    const hook = hookCalls.find((c) => c.name === 'onPaymentSucceeded')
    expect(hook).toBeDefined()
    // The old code read invoice.metadata?.userId, which Stripe does not
    // populate from subscription metadata, so this was always ''.
    expect((hook?.args as { userId: string }).userId).toBe(knownUserId)
  })
})

describe('handleStripeWebhook — failed handling is retryable', () => {
  it('releases the idempotency claim so a retry can re-run the event', async () => {
    const db = getTestDb()
    const { handleStripeWebhook } = await import('./handleWebhook')

    const payload = event(
      'customer.subscription.created',
      buildSubscription({ customer: 'cus_orphan' }),
      'evt_retryable'
    )

    // First delivery fails: the customer carries no user link.
    stripeMock.customers.retrieve.mockResolvedValueOnce({
      id: 'cus_orphan',
      deleted: false,
      metadata: {},
    })
    await expect(handleStripeWebhook(payload, 'sig')).rejects.toThrow()

    // The claim must not survive the failure. If it did, Stripe's retry would
    // short-circuit at the gate, return 2xx, and drop a paid subscription
    // permanently — the precise failure the idempotency gate was added to
    // prevent, reintroduced by the gate itself.
    const ledger = await db.execute(
      sql`SELECT event_id FROM webhook_events WHERE event_id = 'evt_retryable'`
    )
    expect(ledger.rows).toHaveLength(0)

    // The retry now succeeds and provisions the subscription.
    await handleStripeWebhook(payload, 'sig')

    const rows = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.stripeCustomerId, 'cus_orphan'))

    expect(rows).toHaveLength(1)
    expect(rows[0].userId).toBe(knownUserId)
  })
})
