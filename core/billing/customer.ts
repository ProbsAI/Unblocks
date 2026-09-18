import Stripe from 'stripe'
import { eq, and, desc, isNotNull } from 'drizzle-orm'
import { getDb } from '../db/client'
import { subscriptions } from '../db/schema/subscriptions'
import { users } from '../db/schema/users'
import { loadConfig } from '../runtime/configLoader'
import { encrypt } from '../security/encryption'
import { readEmail } from '../security/piiStorage'

function getStripe(): Stripe {
  const config = loadConfig('billing')
  const secretKey = config.stripe.secretKey || process.env.STRIPE_SECRET_KEY
  if (!secretKey) throw new Error('STRIPE_SECRET_KEY is required (set via config or env)')
  return new Stripe(secretKey)
}

export { getStripe }

export async function getOrCreateCustomer(userId: string): Promise<string> {
  const db = getDb()

  // Check if we already have a Stripe customer.
  //
  // Filtered on the column being present, not just taken from the first row:
  // a user can hold several subscription rows, and an unordered LIMIT 1 could
  // return one whose customer id is null while another row has it — creating a
  // second Stripe customer for the same person and splitting their billing.
  const [sub] = await db
    .select({ stripeCustomerId: subscriptions.stripeCustomerId })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.userId, userId),
        isNotNull(subscriptions.stripeCustomerId)
      )
    )
    .orderBy(desc(subscriptions.createdAt))
    .limit(1)

  if (sub?.stripeCustomerId) return sub.stripeCustomerId

  // Get user email for Stripe customer creation
  const [user] = await db
    .select({
      email: users.email,
      emailEncrypted: users.emailEncrypted,
      name: users.name,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!user) throw new Error('User not found')

  // Create Stripe customer
  const stripe = getStripe()
  // Idempotency key, because the lookup above is not a lock: two concurrent
  // checkout or portal requests can both see no customer and both get here.
  // Without this they mint two Stripe customers for one person, and their
  // checkout sessions attach to different ones — split billing, and later
  // webhooks land on whichever the database happened to keep.
  //
  // Stripe returns the original customer for a repeated key, so the race
  // resolves to one object regardless of which write wins locally.
  //
  // Residual: Stripe expires idempotency keys after 24 hours, so a race that
  // straddles that window could still duplicate. Closing that needs a unique
  // constraint on the mapping, which the schema does not have yet.
  const customer = await stripe.customers.create(
    {
      email: readEmail(user),
      name: user.name ?? undefined,
      metadata: { userId },
    },
    { idempotencyKey: `unblocks:customer:${userId}` }
  )

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
