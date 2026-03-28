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
        teamMembers: 5,
        storageGb: 1,
        apiRequestsPerDay: 1000,
        apiKeys: 3,
      },
      features: [
        'auth',
        'billing',
        'ai',
        'api_keys',
        'teams',
        'jobs',
        'uploads_s3',
        'notifications_sse',
        'admin',
        'email',
      ],
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
        apiKeys: 25,
      },
      features: [
        'auth',
        'billing',
        'ai',
        'api_keys',
        'teams',
        'jobs',
        'uploads_s3',
        'notifications_sse',
        'admin',
        'email',
        'data_platform',
        'marketplace',
        'advanced_analytics',
        'premium_templates',
        'priority_support',
      ],
    },
    {
      id: 'business',
      name: 'Business',
      price: { monthly: 299, yearly: 2990 },
      // Replace with your Stripe price IDs from https://dashboard.stripe.com/prices
      stripePriceId: { monthly: 'price_xxx', yearly: 'price_yyy' },
      limits: {
        projects: 999,
        teamMembers: 999,
        storageGb: 500,
        apiRequestsPerDay: 100000,
        apiKeys: 100,
      },
      features: [
        'auth',
        'billing',
        'ai',
        'api_keys',
        'teams',
        'jobs',
        'uploads_s3',
        'notifications_sse',
        'admin',
        'email',
        'data_platform',
        'marketplace',
        'advanced_analytics',
        'premium_templates',
        'priority_support',
        'whitelabel',
        'audit_log',
        'metered_billing',
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
