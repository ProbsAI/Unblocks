import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSelect = vi.fn()
const mockFrom = vi.fn()
const mockWhere = vi.fn()
const mockLimit = vi.fn()
const mockInsert = vi.fn()
const mockValues = vi.fn()
const mockUpdate = vi.fn()
const mockSet = vi.fn()
const mockUpdateWhere = vi.fn()

vi.mock('../db/client', () => ({
  getDb: vi.fn(() => ({
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
  })),
}))

vi.mock('../db/schema/subscriptions', () => ({
  subscriptions: {
    id: 'id',
    userId: 'userId',
    stripeCustomerId: 'stripeCustomerId',
  },
}))

vi.mock('../db/schema/users', () => ({
  users: {
    id: 'id',
    email: 'email',
    name: 'name',
  },
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ a, b })),
}))

const mockStripeCustomersCreate = vi.fn()

vi.mock('../runtime/configLoader', () => ({
  loadConfig: vi.fn().mockReturnValue({
    stripe: { secretKey: 'sk_test_123' },
  }),
}))

vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(() => ({
    customers: {
      create: mockStripeCustomersCreate,
    },
  })),
}))

import { getStripe, getOrCreateCustomer } from './customer'

let selectCallCount: number

function setupMultiSelectChains(results: unknown[][]) {
  selectCallCount = 0
  mockLimit.mockImplementation(() => {
    const result = results[selectCallCount] ?? []
    selectCallCount++
    return Promise.resolve(result)
  })
  mockWhere.mockReturnValue({ limit: mockLimit })
  mockFrom.mockReturnValue({ where: mockWhere })
  mockSelect.mockReturnValue({ from: mockFrom })
}

function setupInsertChain() {
  mockValues.mockResolvedValue(undefined)
  mockInsert.mockReturnValue({ values: mockValues })
}

function setupUpdateChain() {
  mockUpdateWhere.mockResolvedValue(undefined)
  mockSet.mockReturnValue({ where: mockUpdateWhere })
  mockUpdate.mockReturnValue({ set: mockSet })
}

beforeEach(() => {
  vi.clearAllMocks()
  selectCallCount = 0
  setupUpdateChain()
})

describe('getStripe', () => {
  it('returns a Stripe instance', () => {
    const stripe = getStripe()
    expect(stripe).toBeDefined()
    expect(stripe.customers).toBeDefined()
  })
})

describe('getOrCreateCustomer', () => {
  it('returns existing customer ID when found', async () => {
    setupMultiSelectChains([[{ stripeCustomerId: 'cus_existing123' }]])

    const customerId = await getOrCreateCustomer('user-1')

    expect(customerId).toBe('cus_existing123')
    expect(mockStripeCustomersCreate).not.toHaveBeenCalled()
  })

  it('creates new Stripe customer when none exists', async () => {
    mockStripeCustomersCreate.mockResolvedValue({ id: 'cus_new456' })
    setupMultiSelectChains([
      [{ stripeCustomerId: null }], // No existing customer
      [{ email: 'test@example.com', name: 'Test User' }], // User data
      [], // No existing subscription
    ])
    setupInsertChain()

    const customerId = await getOrCreateCustomer('user-1')

    expect(customerId).toBe('cus_new456')
    expect(mockStripeCustomersCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'test@example.com',
        name: 'Test User',
        metadata: { userId: 'user-1' },
      })
    )
  })

  it('throws when user not found', async () => {
    setupMultiSelectChains([
      [{ stripeCustomerId: null }], // No existing customer
      [], // No user
    ])

    await expect(getOrCreateCustomer('missing-user')).rejects.toThrow(
      'User not found'
    )
  })

  it('updates existing subscription record', async () => {
    mockStripeCustomersCreate.mockResolvedValue({ id: 'cus_new789' })
    setupMultiSelectChains([
      [{ stripeCustomerId: null }], // No customer
      [{ email: 'test@example.com', name: null }], // User
      [{ id: 'sub-1' }], // Existing subscription record
    ])
    setupUpdateChain()

    await getOrCreateCustomer('user-1')

    expect(mockUpdate).toHaveBeenCalled()
  })

  it('creates new subscription record when none exists', async () => {
    mockStripeCustomersCreate.mockResolvedValue({ id: 'cus_new789' })
    setupMultiSelectChains([
      [{ stripeCustomerId: null }], // No customer
      [{ email: 'test@example.com', name: 'User' }], // User
      [], // No existing subscription
    ])
    setupInsertChain()

    await getOrCreateCustomer('user-1')

    expect(mockInsert).toHaveBeenCalled()
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        stripeCustomerId: 'cus_new789',
        plan: 'free',
        status: 'active',
      })
    )
  })

  it('handles null name when creating Stripe customer', async () => {
    mockStripeCustomersCreate.mockResolvedValue({ id: 'cus_null_name' })
    setupMultiSelectChains([
      [{ stripeCustomerId: null }],
      [{ email: 'test@example.com', name: null }],
      [],
    ])
    setupInsertChain()

    await getOrCreateCustomer('user-1')

    expect(mockStripeCustomersCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        name: undefined,
      })
    )
  })
})
