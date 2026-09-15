import { eq } from 'drizzle-orm'
import { getDb } from '../db/client'
import { webhookEvents } from '../db/schema/webhookEvents'

/**
 * Idempotency ledger for inbound provider webhooks.
 *
 * Providers deliver at least once and retry on any non-2xx, so a handler must
 * be safe to run twice. The pattern is claim -> handle -> release on failure.
 */

/**
 * Claim an event. Returns true when it had already been claimed, meaning this
 * delivery is a duplicate and must be skipped.
 *
 * The insert is the lock: concurrent deliveries of the same event collide on the
 * primary key and only one of them gets a row back.
 *
 * Known gap: a process that dies between claiming and releasing leaves the row
 * behind and that event is not retried. That window is far narrower than the
 * alternative of not claiming first, which would let concurrent deliveries both
 * apply the same change.
 */
export async function claimEvent(
  eventId: string,
  provider: string,
  type: string
): Promise<boolean> {
  const db = getDb()

  const inserted = await db
    .insert(webhookEvents)
    .values({ eventId, provider, type })
    .onConflictDoNothing({ target: webhookEvents.eventId })
    .returning({ eventId: webhookEvents.eventId })

  return inserted.length === 0
}

/**
 * Drop an event's claim after failed handling so the provider's retry re-runs it.
 *
 * Without this the ledger row survives the failure, the retry short-circuits at
 * the claim and returns 2xx, and the event is dropped permanently — turning
 * every transient error into the silent data loss the ledger exists to prevent.
 *
 * A failure here must not mask the original error — the caller rethrows that —
 * so this swallows its own, at the cost of that one event not being retried.
 */
export async function releaseEvent(eventId: string): Promise<void> {
  try {
    const db = getDb()
    await db.delete(webhookEvents).where(eq(webhookEvents.eventId, eventId))
  } catch (releaseErr) {
    console.error(
      `[billing] Failed to release webhook claim ${eventId}; it will not be retried`,
      releaseErr
    )
  }
}
