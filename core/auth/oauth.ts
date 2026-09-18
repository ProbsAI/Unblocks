import { eq, and } from 'drizzle-orm'
import { getDb } from '../db/client'
import { users } from '../db/schema/users'
import { accounts } from '../db/schema/accounts'
import { runHook } from '../runtime/hookRunner'
import { encrypt, encryptNullable } from '../security/encryption'
import type { User } from './types'
import { toUser } from './toUser'
import { emailColumns, emailMatches } from '../security/piiStorage'

interface GoogleUserInfo {
  sub: string
  email: string
  name: string
  picture: string
  email_verified: boolean
}

export function getGoogleAuthUrl(
  clientId: string,
  redirectUri: string,
  state: string
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'offline',
    prompt: 'consent',
  })

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

export async function exchangeGoogleCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<{ accessToken: string; refreshToken: string | null }> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })

  if (!response.ok) {
    throw new Error('Failed to exchange OAuth code')
  }

  const data = await response.json() as {
    access_token: string
    refresh_token?: string
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
  }
}

export async function getGoogleUserInfo(
  accessToken: string
): Promise<GoogleUserInfo> {
  const response = await fetch(
    'https://www.googleapis.com/oauth2/v3/userinfo',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )

  if (!response.ok) {
    throw new Error('Failed to fetch Google user info')
  }

  return response.json() as Promise<GoogleUserInfo>
}

/**
 * Raised when an OAuth identity resolves to an existing local account that it
 * has not proven ownership of. Callers should surface a "sign in with your
 * password, then link this provider" flow rather than granting a session.
 */
export class OAuthLinkRequiredError extends Error {
  readonly code = 'OAUTH_LINK_REQUIRED'

  constructor(message: string) {
    super(message)
    this.name = 'OAuthLinkRequiredError'
  }
}

export async function handleOAuthCallback(
  provider: string,
  providerAccountId: string,
  accessToken: string,
  refreshToken: string | null,
  userInfo: {
    email: string
    name: string
    avatarUrl: string
    emailVerified: boolean
  }
): Promise<User> {
  const db = getDb()

  // Check if OAuth account already linked
  const [existingAccount] = await db
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.provider, provider),
        eq(accounts.providerAccountId, providerAccountId)
      )
    )
    .limit(1)

  if (existingAccount) {
    // Update tokens (encrypted only — no plaintext storage)
    await db
      .update(accounts)
      .set({
        accessToken: null,
        accessTokenEncrypted: encrypt(accessToken),
        refreshToken: null,
        refreshTokenEncrypted: encryptNullable(refreshToken),
      })
      .where(eq(accounts.id, existingAccount.id))

    // Return existing user
    const [dbUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, existingAccount.userId))
      .limit(1)

    return toUser(dbUser)
  }

  // Check if user with this email exists
  const [existingUser] = await db
    .select()
    .from(users)
    .where(emailMatches(userInfo.email))
    .limit(1)

  let userId: string

  if (existingUser) {
    // Linking by email address requires BOTH sides to have proven control of
    // that address. Checking only one side leaves a takeover path open:
    //
    //  - Provider unverified: an attacker registers an identity at a provider
    //    that does not verify addresses and claims a victim's account.
    //  - Local account unverified: an attacker registers victim@example.com
    //    locally and never verifies it. If the real owner later arrives with a
    //    verified provider identity, auto-linking would attach it to the
    //    ATTACKER's row. verifyCredentials now also refuses unverified
    //    password sign-in, which closes the other half of that chain, but this
    //    guard stands on its own: an unverified row is not proof of anything.
    //
    // The second case is why checking userInfo.emailVerified alone was not
    // enough. Refusing to auto-link is the safe default; an authenticated
    // explicit-link flow is the correct way to join the two.
    if (!userInfo.emailVerified) {
      throw new OAuthLinkRequiredError(
        `${provider} did not verify this email address; sign in and link ${provider} from account settings instead`
      )
    }

    if (!existingUser.emailVerified) {
      throw new OAuthLinkRequiredError(
        `An unverified account already exists for this email address; verify it and link ${provider} from account settings instead`
      )
    }

    userId = existingUser.id
    // Update user info if not set
    if (!existingUser.name || !existingUser.avatarUrl) {
      const updatedName = existingUser.name ?? userInfo.name
      await db
        .update(users)
        .set({
          name: updatedName,
          avatarUrl: existingUser.avatarUrl ?? userInfo.avatarUrl,
          updatedAt: new Date(),
        })
        .where(eq(users.id, existingUser.id))
    }
  } else {
    // An unverified address cannot be used to create an account either.
    //
    // Refusing to *link* an unverified identity to an existing account was only
    // half the problem. A provider that lets anyone claim an arbitrary address
    // could still register victim@example.com here, and the callback would
    // issue a session for it. The account then sits there until the real owner
    // arrives — and because createMagicLink finds an existing user by email and
    // marks it verified, the owner ends up signing into the ATTACKER's account,
    // with the attacker's provider identity still linked to it.
    //
    // Google, the only provider implemented, always asserts email_verified, so
    // this costs nothing today. It is here so adding a laxer provider does not
    // silently open the path.
    if (!userInfo.emailVerified) {
      throw new OAuthLinkRequiredError(
        `${provider} did not verify this email address, so it cannot be used to create an account; sign up directly and link ${provider} afterwards`
      )
    }

    // Create new user with encrypted PII
    const emailLower = userInfo.email.toLowerCase()
    const [newUser] = await db
      .insert(users)
      .values({
        ...emailColumns(emailLower),
        name: userInfo.name,
        avatarUrl: userInfo.avatarUrl,
        // Trust the provider's assertion rather than assuming verification.
        emailVerified: userInfo.emailVerified,
      })
      .returning()

    userId = newUser.id

    void runHook('onUserCreated', {
      user: toUser(newUser),
      method: 'oauth',
    })
  }

  // Link OAuth account (encrypted only — no plaintext token storage)
  await db.insert(accounts).values({
    userId,
    provider,
    providerAccountId,
    accessToken: null,
    accessTokenEncrypted: encrypt(accessToken),
    refreshToken: null,
    refreshTokenEncrypted: encryptNullable(refreshToken),
  })

  const [dbUser] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  return toUser(dbUser)
}
