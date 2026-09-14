import { eq, and, gt, isNull } from 'drizzle-orm'
import { getDb } from '../db/client'
import { verificationTokens } from '../db/schema/verificationTokens'
import { blindIndex } from '../security/blindIndex'

/** The token kinds stored in `verification_tokens`. */
export type VerificationTokenType =
  | 'magic_link'
  | 'email_verification'
  | 'password_reset'

/**
 * Consume a single-use token, atomically.
 *
 * Returns the row if this caller won it, null if the token is unknown, expired,
 * or was already consumed — by anyone, including a concurrent request.
 *
 * ## Why this is one statement and not a SELECT then an UPDATE
 *
 * Every consumer here used to read the row, check `used_at IS NULL`, and then
 * mark it used. Between the read and the write, a second request can read the
 * same row and see the same null. Both pass, both proceed, and the token is
 * used twice — which for a magic link means two sessions from one emailed
 * link, and for a password reset means two resets from one. "Single use" was
 * enforced only by timing.
 *
 * `UPDATE ... WHERE used_at IS NULL ... RETURNING` cannot be raced: Postgres
 * re-evaluates the predicate after taking the row lock, so exactly one
 * concurrent statement matches and the rest come back empty. This is the same
 * shape as the jobs queue's claim and the subscription placeholder claim.
 *
 * The consequence for callers is that **winning the claim consumes the token
 * even if the work that follows fails**. That is the right trade for a
 * credential: a failed attempt costs the user a fresh link, whereas leaving it
 * claimable costs single-use entirely. Do not "fix" that by reverting to a
 * read-then-write.
 */
export async function claimVerificationToken(
  token: string,
  type: VerificationTokenType
): Promise<typeof verificationTokens.$inferSelect | null> {
  const db = getDb()

  const [claimed] = await db
    .update(verificationTokens)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(verificationTokens.tokenHash, blindIndex(token)),
        eq(verificationTokens.type, type),
        gt(verificationTokens.expiresAt, new Date()),
        isNull(verificationTokens.usedAt)
      )
    )
    .returning()

  return claimed ?? null
}
