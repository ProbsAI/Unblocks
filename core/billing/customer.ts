import Stripe from 'stripe'
import { eq } from 'drizzle-orm'
import { getDb } from '../db/client'
import { subscriptions } from '../db/schema/subscriptions'
import { users } from '../db/schema/users'
import { loadConfig } from '../runtime/configLoader'
import { encrypt } from '../security/encryption'

function getStripe(): Stripe {
  const config = loadConfig('billing')
  const secretKey = config.stripe.secretKey || process.env.STRIPE_SECRET_KEY
  if (!secretKey) throw new Error('STRIPE_SECRET_KEY is required (set via config or env)')
  return new Stripe(secretKey)
}

export { getStripe }

export async function getOrCreateCustomer(userId: string): Promise<string> {
  const db = getDb()

  // Check if we already have a Stripe customer
  const [sub] = await db
    .select({ stripeCustomerId: subscriptions.stripeCustomerId })
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1)

  if (sub?.stripeCustomerId) return sub.stripeCustomerId

  // Get user email for Stripe customer creation
  const [user] = await db
    .select({ email: users.email, name: users.name })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!user) throw new Error('User not found')

  // Create Stripe customer
  const stripe = getStripe()
  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name ?? undefined,
    metadata: { userId },
  })

  // Upsert subscription record with customer ID
  const [existing] = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1)

  if (existing) {
    await db
      .update(subscriptions)
      .set({
        stripeCustomerId: customer.id,
        stripeCustomerIdEncrypted: encrypt(customer.id),
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, existing.id))
  } else {
    await db.insert(subscriptions).values({
      userId,
      stripeCustomerId: customer.id,
      stripeCustomerIdEncrypted: encrypt(customer.id),
      plan: 'free',
      status: 'active',
    })
  }

  return customer.id
}
