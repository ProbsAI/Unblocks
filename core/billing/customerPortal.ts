import { getStripe, getOrCreateCustomer } from './customer'

export async function createCustomerPortalSession(
  userId: string
): Promise<{ url: string }> {
  const stripe = getStripe()
  const customerId = await getOrCreateCustomer(userId)
  const appUrl = process.env.APP_URL ?? 'http://localhost:3000'

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${appUrl}/dashboard/billing`,
  })

  return { url: session.url }
}
