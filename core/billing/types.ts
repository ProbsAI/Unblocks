import { z } from 'zod'

const PlanLimitsSchema = z.object({
  projects: z.number().default(3),
  teamMembers: z.number().default(1),
  storageGb: z.number().default(1),
  apiRequestsPerDay: z.number().default(100),
  /** Maximum concurrently active (non-revoked) API keys. */
  apiKeys: z.number().default(3),
})

const PlanPriceSchema = z.object({
  monthly: z.number(),
  yearly: z.number(),
})

const StripePriceIdSchema = z.object({
  monthly: z.string().nullable(),
  yearly: z.string().nullable(),
})

const PlanSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: PlanPriceSchema,
  stripePriceId: StripePriceIdSchema,
  limits: PlanLimitsSchema,
  features: z.array(z.string()),
})

export const BillingConfigSchema = z.object({
  provider: z.enum(['stripe']).default('stripe'),

  stripe: z.object({
    publicKey: z.string().default(''),
    secretKey: z.string().default(''),
    webhookSecret: z.string().default(''),
  }).default({}),

  plans: z.array(PlanSchema).default([
    {
      id: 'free',
      name: 'Free',
      price: { monthly: 0, yearly: 0 },
      stripePriceId: { monthly: null, yearly: null },
      limits: { projects: 3, teamMembers: 1, storageGb: 1, apiRequestsPerDay: 100 },
      features: ['basic_dashboard', 'email_support'],
    },
  ]),

  trial: z.object({
    enabled: z.boolean().default(true),
    days: z.number().default(14),
    defaultPlan: z.string().default('pro'),
    requirePaymentMethod: z.boolean().default(false),
  }).default({}),

  behavior: z.object({
    allowDowngrade: z.boolean().default(true),
    prorateOnChange: z.boolean().default(true),
    gracePeriodDays: z.number().default(3),
    cancelAtPeriodEnd: z.boolean().default(true),
    collectTaxId: z.boolean().default(false),
  }).default({}),
}).superRefine((config, ctx) => {
  // Two plans must never share a Stripe price id.
  //
  // planIdForPrice() returns the first match, so a webhook carrying no
  // Checkout metadata grants whichever plan happens to be listed first — a
  // Business subscription provisioned as Pro. This used to be reachable with
  // the shipped config, whose Pro and Business placeholders were identical.
  //
  // Enforced here rather than left as a documented rule, because the failure
  // is silent at runtime: the wrong entitlement is granted and nothing errors.
  const seen = new Map<string, string>()

  for (const plan of config.plans) {
    for (const interval of ['monthly', 'yearly'] as const) {
      const priceId = plan.stripePriceId[interval]
      if (!priceId) continue

      const owner = seen.get(priceId)
      if (owner) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['plans'],
          message: `Stripe price id "${priceId}" is used by both "${owner}" and "${plan.id}". A webhook cannot tell them apart, so give each plan its own price id.`,
        })
        continue
      }

      seen.set(priceId, plan.id)
    }
  }
})

export type BillingConfig = z.infer<typeof BillingConfigSchema>

export type Plan = z.infer<typeof PlanSchema>

export interface Subscription {
  id: string
  userId: string
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  stripePriceId: string | null
  plan: string
  status: string
  interval: string | null
  currentPeriodStart: Date | null
  currentPeriodEnd: Date | null
  cancelAtPeriodEnd: boolean
  trialEnd: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface OnSubscriptionCreatedArgs {
  userId: string
  plan: Plan
  subscription: Subscription
}

export interface OnSubscriptionChangedArgs {
  userId: string
  oldPlan: string
  newPlan: string
  subscription: Subscription
}

export interface OnPaymentSucceededArgs {
  userId: string
  amount: number
  plan: string
  invoiceUrl: string | null
}

export interface OnPaymentFailedArgs {
  userId: string
  amount: number
  error: string
}
