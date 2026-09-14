import { eq, and, gt, isNull } from 'drizzle-orm'
import { getDb } from '../db/client'
import { users } from '../db/schema/users'
import { verificationTokens } from '../db/schema/verificationTokens'
import { generateRandomToken, isWellFormedToken } from './token'
import { runHook } from '../runtime/hookRunner'
import { AuthError, NotFoundError } from '../errors/types'
import { encrypt } from '../security/encryption'
import { blindIndex, slowBlindIndex } from '../security/blindIndex'
import { claimVerificationToken } from './verificationTokens'
import type { User } from './types'

export async function createMagicLink(email: string): Promise<string> {
  const db = getDb()
  const emailLower = email.toLowerCase()

  // Derived before the branch, deliberately, even though only the create path
  // stores it.
  //
  // slowBlindIndex is ~260ms of PBKDF2. Running it only when the address is new
  // made "does this account exist?" directly observable as a response-time
  // difference — defeating the enumeration defence the route's deferred email
  // send exists to provide. Paying it on both paths costs a known, constant
  // amount and reveals nothing.
  const emailHash = slowBlindIndex(emailLower)

  // Find or create user
  let [dbUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, emailLower))
    .limit(1)

  if (!dbUser) {
    // Create user without password
    const [newUser] = await db
      .insert(users)
      .values({
        email: emailLower,
        emailEncrypted: encrypt(emailLower),
        emailHash,
        emailVerified: false,
      })
      .returning()
    dbUser = newUser

    void runHook('onUserCreated', {
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        avatarUrl: newUser.avatarUrl,
        emailVerified: newUser.emailVerified,
        status: newUser.status,
        createdAt: newUser.createdAt,
        updatedAt: newUser.updatedAt,
      },
      method: 'magic_link',
    })
  }

  // Generate token
  const token = generateRandomToken()
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000) // 15 minutes

  await db.insert(verificationTokens).values({
    token: blindIndex(token),
    tokenHash: blindIndex(token),
    email: emailLower,
    emailEncrypted: encrypt(emailLower),
    type: 'magic_link',
    expiresAt,
  })

  return token
}

/**
 * Reads the account a magic link points at WITHOUT consuming the token.
 *
 * The confirmation interstitial needs this: verifyMagicLink marks the token
 * used, so a page that called it just to render "sign in as ..." would burn the
 * link before the person clicked anything.
 *
 * This discloses nothing new. The only way to reach it is to already hold the
 * token, and holding the token is enough to complete the sign-in and read the
 * address from the account itself. Showing the address is the whole point of
 * the interstitial: a link planted by an attacker names the ATTACKER's account,
 * which is what gives the recipient something to refuse.
 *
 * Returns null for a token that is unknown, expired, or already used — the
 * same conditions verifyMagicLink rejects, so the page and the POST agree.
 */
export async function peekMagicLink(
  token: string
): Promise<{ email: string } | null> {
  // Same bound as the claim path: this is reached straight from a public query
  // string, and blindIndex is PBKDF2.
  if (!isWellFormedToken(token)) return null

  const db = getDb()

  const [dbToken] = await db
    .select({ email: verificationTokens.email })
    .from(verificationTokens)
    .where(
      and(
        eq(verificationTokens.tokenHash, blindIndex(token)),
        eq(verificationTokens.type, 'magic_link'),
        gt(verificationTokens.expiresAt, new Date()),
        isNull(verificationTokens.usedAt)
      )
    )
    .limit(1)

  return dbToken ? { email: dbToken.email } : null
}

export async function verifyMagicLink(token: string): Promise<User> {
  const db = getDb()

  // Claim atomically. Reading the row and then marking it used let two
  // concurrent POSTs from the confirmation page both pass the unused check and
  // both create a session from one emailed link.
  const dbToken = await claimVerificationToken(token, 'magic_link')

  if (!dbToken) {
    throw new AuthError('INVALID_TOKEN', 'Invalid or expired magic link')
  }

  // Get user and mark email as verified
  const [dbUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, dbToken.email))
    .limit(1)

  if (!dbUser) {
    throw new NotFoundError('User')
  }

  if (!dbUser.emailVerified) {
    await db
      .update(users)
      .set({
        emailVerified: true,
        emailVerifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, dbUser.id))
  }

  return {
    id: dbUser.id,
    email: dbUser.email,
    name: dbUser.name,
    avatarUrl: dbUser.avatarUrl,
    emailVerified: true,
    status: dbUser.status,
    createdAt: dbUser.createdAt,
    updatedAt: dbUser.updatedAt,
  }
}
