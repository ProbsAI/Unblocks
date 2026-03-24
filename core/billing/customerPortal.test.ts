import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockPortalCreate = vi.fn()

vi.mock('./customer', () => ({
  getStripe: vi.fn(() => ({
    billingPortal: {
      sessions: {
        create: mockPortalCreate,
      },
    },
  })),
  getOrCreateCustomer: vi.fn().mockResolvedValue('cus_123'),
}))

import { createCustomerPortalSession } from './customerPortal'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('createCustomerPortalSession', () => {
  it('creates billing portal session and returns URL', async () => {
    mockPortalCreate.mockResolvedValue({
      url: 'https://billing.stripe.com/portal/session-123',
    })

    const result = await createCustomerPortalSession('user-1')

    expect(result.url).toBe('https://billing.stripe.com/portal/session-123')
    expect(mockPortalCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: 'cus_123',
        return_url: expect.stringContaining('/dashboard/billing'),
      })
    )
  })

  it('uses APP_URL for return_url', async () => {
    const originalUrl = process.env.APP_URL
    process.env.APP_URL = 'https://myapp.com'

    mockPortalCreate.mockResolvedValue({
      url: 'https://billing.stripe.com/portal/session',
    })

    await createCustomerPortalSession('user-1')

    expect(mockPortalCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        return_url: 'https://myapp.com/dashboard/billing',
      })
    )

    process.env.APP_URL = originalUrl
  })
})
