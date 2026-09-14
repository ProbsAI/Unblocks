import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Unit tests for the webhook entry point.
 *
 * Scope is deliberately narrow: only the boundary behaviour that can be
 * asserted without a database — secret handling, that signature verification is
 * genuinely delegated to Stripe, and the idempotency gate's decision.
 *
 * Everything about what the handler WRITES is covered by
 * handleWebhook.integration.test.ts against a real Postgres. The previous
 * version of this file mocked drizzle-orm's query builder and pre-seeded every
 * lookup, which made it structurally incapable of detecting the missing
 * checkout.session.completed handler, the absent idempotency, or the dropped
 * subscription insert. Assertions about mocked call shapes are not coverage.
 */

const mockConstructEvent = vi.fn()
const mockReturning = vi.fn()
const mockOnConflict = vi.fn(() => ({ returning: mockReturning }))
const mockValues = vi.fn(() => ({ onConflictDoNothing: mockOnConflict }))
const mockInsert = vi.fn(() => ({ values: mockValues }))
const mockSelect = vi.fn()
const mockUpdate = vi.fn()

vi.mock('../db/client', () => ({
  getDb: vi.fn(() => ({
    insert: mockInsert,
    select: mockSelect,
    update: mockUpdate,
  })),
}))

vi.mock('./customer', () => ({
  getStripe: vi.fn(() => ({
    webhooks: { constructEvent: mockConstructEvent },
  })),
}))

vi.mock('../runtime/hookRunner', () => ({
  runHook: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('./plans', () => ({
  getAllPlans: vi.fn().mockReturnValue([
    { id: 'free', price: { monthly: 0 }, stripePriceId: { monthly: null, yearly: null } },
    { id: 'pro', price: { monthly: 20 }, stripePriceId: { monthly: 'price_pro', yearly: null } },
  ]),
}))

import { handleStripeWebhook } from './handleWebhook'

/** Treat this delivery as new, so the handler proceeds past the gate. */
function eventIsNew(): void {
  mockReturning.mockResolvedValue([{ eventId: 'evt_1' }])
}

/** Treat this delivery as already seen, so the handler must stop. */
function eventIsDuplicate(): void {
  mockReturning.mockResolvedValue([])
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'
  mockConstructEvent.mockReturnValue({
    id: 'evt_1',
    type: 'some.unhandled.event',
    data: { object: {} },
  })
  eventIsNew()
})

describe('handleStripeWebhook — secret handling', () => {
  it('throws when STRIPE_WEBHOOK_SECRET is absent', async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET

    await expect(handleStripeWebhook('{}', 'sig')).rejects.toThrow(
      'STRIPE_WEBHOOK_SECRET is required'
    )
  })

  it('never reaches the idempotency gate without a secret', async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET

    await expect(handleStripeWebhook('{}', 'sig')).rejects.toThrow()
    expect(mockInsert).not.toHaveBeenCalled()
  })
})

describe('handleStripeWebhook — signature verification', () => {
  it('delegates verification to Stripe with the raw payload, signature and secret', async () => {
    await handleStripeWebhook('raw-body', 'sig-header')

    expect(mockConstructEvent).toHaveBeenCalledWith(
      'raw-body',
      'sig-header',
      'whsec_test'
    )
  })

  it('propagates a verification failure instead of processing the event', async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error('No signatures found matching the expected signature')
    })

    await expect(handleStripeWebhook('tampered', 'bad-sig')).rejects.toThrow(
      /signature/i
    )
    expect(mockInsert).not.toHaveBeenCalled()
  })
})

describe('handleStripeWebhook — idempotency gate', () => {
  it('records the event before doing any work', async () => {
    await handleStripeWebhook('{}', 'sig')

    expect(mockInsert).toHaveBeenCalledTimes(1)
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: 'evt_1', provider: 'stripe' })
    )
  })

  it('stops before handling when the event was already recorded', async () => {
    eventIsDuplicate()
    mockConstructEvent.mockReturnValue({
      id: 'evt_1',
      type: 'customer.subscription.deleted',
      data: { object: { customer: 'cus_1' } },
    })

    await handleStripeWebhook('{}', 'sig')

    // A duplicate must not reach the cancellation write.
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('proceeds to handling when the event is new', async () => {
    mockConstructEvent.mockReturnValue({
      id: 'evt_2',
      type: 'customer.subscription.deleted',
      data: { object: { customer: 'cus_1' } },
    })
    mockUpdate.mockReturnValue({
      set: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
    })

    await handleStripeWebhook('{}', 'sig')

    expect(mockUpdate).toHaveBeenCalled()
  })
})

describe('handleStripeWebhook — unknown events', () => {
  it('ignores event types it does not handle without throwing', async () => {
    await expect(handleStripeWebhook('{}', 'sig')).resolves.toBeUndefined()
  })
})
