import type { BillingConfig } from '@unblocks/core/billing/types'

/**
 * Billing configuration.
 *
 * To connect Stripe:
 * 1. Create products and prices in your Stripe Dashboard (https://dashboard.stripe.com/products)
 * 2. Copy each price ID (starts with "price_") into the stripePriceId fields below
 * 3. Set STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY, and STRIPE_WEBHOOK_SECRET in your .env
 *
 * The free plan has no Stripe price IDs (null) since it doesn't require payment.
 */
const billingConfig: BillingConfig = {
  provider: 'stripe',
  stripe: {
    publicKey: process.env.STRIPE_PUBLISHABLE_KEY ?? '',
    secretKey: process.env.STRIPE_SECRET_KEY ?? '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
  },
  plans: [
    {
      id: 'free',
      name: 'Free',
      price: { monthly: 0, yearly: 0 },
      stripePriceId: { monthly: null, yearly: null },
      limits: {
        projects: 3,
        teamMembers: 1,
        storageGb: 1,
        apiRequestsPerDay: 100,
      },
      features: ['basic_dashboard', 'email_support'],
    },
    {
      id: 'pro',
      name: 'Pro',
      price: { monthly: 29, yearly: 290 },
      // Replace with your Stripe price IDs from https://dashboard.stripe.com/prices
      stripePriceId: { monthly: 'price_xxx', yearly: 'price_yyy' },
      limits: {
        projects: 999,
        teamMembers: 10,
        storageGb: 50,
        apiRequestsPerDay: 10000,
      },
      features: [
        'basic_dashboard',
        'email_support',
        'api_access',
        'priority_support',
      ],
    },
    {
      id: 'business',
      name: 'Business',
      price: { monthly: 99, yearly: 990 },
      // Replace with your Stripe price IDs from https://dashboard.stripe.com/prices
      stripePriceId: { monthly: 'price_xxx', yearly: 'price_yyy' },
      limits: {
        projects: 999,
        teamMembers: 999,
        storageGb: 500,
        apiRequestsPerDay: 100000,
      },
      features: [
        'basic_dashboard',
        'email_support',
        'api_access',
        'priority_support',
        'sso',
        'audit_log',
      ],
    },
  ],
  trial: {
    enabled: true,
    days: 14,
    defaultPlan: 'pro',
    requirePaymentMethod: false,
  },
  behavior: {
    allowDowngrade: true,
    prorateOnChange: true,
    gracePeriodDays: 3,
    cancelAtPeriodEnd: true,
    collectTaxId: false,
  },
}

export default billingConfig
