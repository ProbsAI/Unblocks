import { getStripe, getOrCreateCustomer } from './customer'
import { getPlanById } from './plans'

export async function createCheckoutSession(
  userId: string,
  planId: string,
  interval: 'monthly' | 'yearly' = 'monthly'
): Promise<{ url: string }> {
  const stripe = getStripe()
  const plan = getPlanById(planId)

  const priceId = plan.stripePriceId[interval]
  if (!priceId) {
    throw new Error(`No Stripe price configured for ${planId} (${interval})`)
  }

  const customerId = await getOrCreateCustomer(userId)
  const appUrl = process.env.APP_URL ?? 'http://localhost:3000'

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/dashboard/billing?success=true`,
    cancel_url: `${appUrl}/dashboard/billing?canceled=true`,
    metadata: { userId, planId },
  })

  if (!session.url) {
    throw new Error('Failed to create checkout session')
  }

  return { url: session.url }
}
