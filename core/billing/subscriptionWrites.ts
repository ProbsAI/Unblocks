import Stripe from 'stripe'
import { eq, and } from 'drizzle-orm'
import { getDb } from '../db/client'
import { subscriptions } from '../db/schema/subscriptions'
import { encryptNullable } from '../security/encryption'
import { customerIdOf, periodBounds } from './stripeShapes'
import {
  resolvePlan,
  findSubscriptionRow,
  claimPlaceholderRow,
  notStale,
  resolveUserId,
} from './webhookResolution'

/**
 * The writes a Stripe subscription event performs.
 *
 * Split from handleWebhook.ts, which is about receiving and dispatching an
 * event; this is about what lands in the database, and carries all of the
 * ordering and concurrency guards.
 */

export async function handleSubscriptionUpdate(
  stripeSubscription: Stripe.Subscription,
  eventAt: Date,
  userIdHint?: string | null,
  planHint?: string | null
): Promise<void> {
  const db = getDb()
  const customerId = customerIdOf(stripeSubscription.customer)
  const item = stripeSubscription.items.data[0]
  const priceId = item?.price.id ?? null

  const planId = resolvePlan(
    priceId,
    planHint,
    item?.price.metadata?.planId,
    stripeSubscription.id
  )

  const period = periodBounds(stripeSubscription)

  const subData = {
    stripeSubscriptionId: stripeSubscription.id,
    stripeSubscriptionIdEncrypted: encryptNullable(stripeSubscription.id),
    stripePriceId: priceId,
    plan: planId,
    status: stripeSubscription.status,
    interval: item?.price.recurring?.interval ?? null,
    currentPeriodStart: period.start,
    currentPeriodEnd: period.end,
    cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
    trialEnd: stripeSubscription.trial_end
      ? new Date(stripeSubscription.trial_end * 1000)
      : null,
    lastEventAt: eventAt,
    updatedAt: new Date(),
  }

  const existing = await findSubscriptionRow(stripeSubscription.id)

  if (existing) {
    await db
      .update(subscriptions)
      .set(subData)
      .where(and(eq(subscriptions.id, existing.id), notStale(eventAt)))
    return
  }

  // Take over the customer's placeholder row if there is one. Atomic, because
  // two first-time events for the same customer would otherwise both write to
  // it and lose one subscription — see claimPlaceholderRow.
  if (await claimPlaceholderRow(customerId, subData)) return

  // No local row yet — a first-time subscriber, or a row that was never
  // created. Previously this event was dropped silently and the customer paid
  // without ever receiving entitlement.
  const userId = userIdHint ?? (await resolveUserId(customerId))

  if (!userId) {
    // Throwing returns a non-2xx so Stripe retries rather than treating the
    // event as delivered. Never swallow an unlinkable paid subscription.
    throw new Error(
      `Cannot link Stripe customer ${customerId} to a user; subscription ${stripeSubscription.id} not applied`
    )
  }

  // Upsert rather than plain insert. Two events for the same subscription can
  // reach this branch concurrently — they carry different event ids, so the
  // idempotency ledger lets both through — and the unique constraint would
  // otherwise turn the loser into an error instead of an update.
  //
  // userId is deliberately absent from the conflict update: a row's owner is
  // established once, and a later event must not move a subscription between
  // accounts.
  await db
    .insert(subscriptions)
    .values({
      userId,
      stripeCustomerId: customerId,
      // getOrCreateCustomer stores both; provisioning through this path must
      // not leave the encrypted-at-rest copy missing.
      stripeCustomerIdEncrypted: encryptNullable(customerId),
      ...subData,
    })
    .onConflictDoUpdate({
      target: subscriptions.stripeSubscriptionId,
      set: subData,
      // The conflict path needs the same staleness guard as the update path
      // above. Without it, two events racing to provision the same
      // subscription can land newest-first, and the older one then wins the
      // conflict update and rolls plan and status back.
      setWhere: notStale(eventAt),
    })
}

export async function handleSubscriptionDeleted(
  stripeSubscription: Stripe.Subscription,
  eventAt: Date
): Promise<void> {
  const db = getDb()

  const cancellation = {
    status: 'canceled',
    plan: 'free',
    cancelAtPeriodEnd: false,
    lastEventAt: eventAt,
    updatedAt: new Date(),
  }

  // Scoped to the subscription being deleted. Filtering by customer cancelled
  // every subscription that customer held, so an out-of-order deletion of an
  // old subscription revoked entitlement for the current one.
  const updated = await db
    .update(subscriptions)
    .set(cancellation)
    .where(
      and(
        eq(subscriptions.stripeSubscriptionId, stripeSubscription.id),
        notStale(eventAt)
      )
    )
    .returning({ id: subscriptions.id })

  if (updated.length > 0) return

  // Nothing was updated, for one of two reasons. Either the row exists and a
  // newer event already applied — correct to ignore — or no row exists at all,
  // which means this deletion overtook the create/update that would have made
  // one.
  if (await findSubscriptionRow(stripeSubscription.id)) return

  // Deletion arrived first. Write a tombstone rather than discarding the
  // event: without a row there is no last_event_at, so the late create would
  // insert an *active* subscription and restore entitlement to something the
  // provider has already cancelled. The tombstone makes that create stale.
  const customerId = customerIdOf(stripeSubscription.customer)
  const userId = await resolveUserId(customerId)

  if (!userId) {
    // Same contract as provisioning: throw so Stripe retries rather than
    // treating an unrecorded cancellation as delivered.
    throw new Error(
      `Cannot link Stripe customer ${customerId} to a user; cancellation of ${stripeSubscription.id} not applied`
    )
  }

  await db
    .insert(subscriptions)
    .values({
      userId,
      stripeCustomerId: customerId,
      stripeCustomerIdEncrypted: encryptNullable(customerId),
      stripeSubscriptionId: stripeSubscription.id,
      stripeSubscriptionIdEncrypted: encryptNullable(stripeSubscription.id),
      ...cancellation,
    })
    // A concurrent create may have inserted the row between the UPDATE above
    // and this INSERT. Doing nothing on conflict would drop the cancellation
    // and leave that active row standing, so apply it — still guarded, so a
    // genuinely newer create wins.
    .onConflictDoUpdate({
      target: subscriptions.stripeSubscriptionId,
      set: cancellation,
      setWhere: notStale(eventAt),
    })
}
