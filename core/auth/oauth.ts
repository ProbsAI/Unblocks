import { eq, and } from 'drizzle-orm'
import { getDb } from '../db/client'
import { users } from '../db/schema/users'
import { accounts } from '../db/schema/accounts'
import { runHook } from '../runtime/hookRunner'
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

export async function handleOAuthCallback(
  provider: string,
  providerAccountId: string,
  accessToken: string,
  refreshToken: string | null,
  userInfo: { email: string; name: string; avatarUrl: string }
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
    // Update tokens
    await db
      .update(accounts)
      .set({ accessToken, refreshToken })
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
    userId = existingUser.id
    // Update user info if not set
    if (!existingUser.name || !existingUser.avatarUrl) {
      await db
        .update(users)
        .set({
          name: existingUser.name ?? userInfo.name,
          avatarUrl: existingUser.avatarUrl ?? userInfo.avatarUrl,
          emailVerified: true,
          updatedAt: new Date(),
        })
        .where(eq(users.id, existingUser.id))
    }
  } else {
    // Create new user
    const [newUser] = await db
      .insert(users)
      .values({
        email: userInfo.email.toLowerCase(),
        name: userInfo.name,
        avatarUrl: userInfo.avatarUrl,
        emailVerified: true,
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

  // Link OAuth account
  await db.insert(accounts).values({
    userId,
    provider,
    providerAccountId,
    accessToken,
    refreshToken,
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
