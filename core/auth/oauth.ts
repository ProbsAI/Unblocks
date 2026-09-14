import { eq, and } from 'drizzle-orm'
import { getDb } from '../db/client'
import { users } from '../db/schema/users'
import { accounts } from '../db/schema/accounts'
import { runHook } from '../runtime/hookRunner'
import { encrypt, encryptNullable } from '../security/encryption'
import { blindIndex } from '../security/blindIndex'
import type { User } from './types'

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

    return {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      avatarUrl: dbUser.avatarUrl,
      emailVerified: dbUser.emailVerified,
      status: dbUser.status,
      createdAt: dbUser.createdAt,
      updatedAt: dbUser.updatedAt,
    }
  }

  // Check if user with this email exists
  const [existingUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, userInfo.email.toLowerCase()))
    .limit(1)

  let userId: string

  if (existingUser) {
    // Linking by email address requires BOTH sides to have proven control of
    // that address. Checking only one side leaves a takeover path open:
    //
    //  - Provider unverified: an attacker registers an identity at a provider
    //    that does not verify addresses and claims a victim's account.
    //  - Local account unverified: an attacker registers victim@example.com
    //    locally and never verifies it. verifyCredentials permits an unverified
    //    account to sign in (it checks status, not emailVerified), so when the
    //    real owner later signs in with a verified provider identity, that
    //    identity is linked to the ATTACKER's account and the attacker's
    //    password keeps working.
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
          nameEncrypted: encryptNullable(updatedName),
          avatarUrl: existingUser.avatarUrl ?? userInfo.avatarUrl,
          updatedAt: new Date(),
        })
        .where(eq(users.id, existingUser.id))
    }
  } else {
    // Create new user with encrypted PII
    const emailLower = userInfo.email.toLowerCase()
    const [newUser] = await db
      .insert(users)
      .values({
        email: emailLower,
        emailEncrypted: encrypt(emailLower),
        emailHash: blindIndex(emailLower),
        name: userInfo.name,
        nameEncrypted: encryptNullable(userInfo.name),
        avatarUrl: userInfo.avatarUrl,
        // Trust the provider's assertion rather than assuming verification.
        emailVerified: userInfo.emailVerified,
      })
      .returning()

    userId = newUser.id

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

  return {
    id: dbUser.id,
    email: dbUser.email,
    name: dbUser.name,
    avatarUrl: dbUser.avatarUrl,
    emailVerified: dbUser.emailVerified,
    status: dbUser.status,
    createdAt: dbUser.createdAt,
    updatedAt: dbUser.updatedAt,
  }
}
