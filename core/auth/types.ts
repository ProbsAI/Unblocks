import { z } from 'zod'

export const AuthConfigSchema = z.object({
  providers: z.object({
    email: z.object({ enabled: z.boolean().default(true) }).default({}),
    google: z.object({
      enabled: z.boolean().default(false),
      clientId: z.string().default(''),
      clientSecret: z.string().default(''),
    }).default({}),
    magicLink: z.object({ enabled: z.boolean().default(false) }).default({}),
  }).default({}),

  session: z.object({
    strategy: z.enum(['jwt', 'database']).default('jwt'),
    duration: z.string().default('7d'),
    refreshWindow: z.string().default('1d'),
    maxConcurrentSessions: z.number().default(5),
  }).default({}),

  password: z.object({
    minLength: z.number().default(8),
    requireUppercase: z.boolean().default(false),
    requireNumber: z.boolean().default(false),
    requireSpecial: z.boolean().default(false),
  }).default({}),

  security: z.object({
    maxLoginAttempts: z.number().default(5),
    lockoutDuration: z.string().default('15m'),
    requireEmailVerification: z.boolean().default(true),
    allowSignup: z.boolean().default(true),
    allowPasswordReset: z.boolean().default(true),
    csrfProtection: z.boolean().default(true),
  }).default({}),

  redirects: z.object({
    afterLogin: z.string().default('/dashboard'),
    afterLogout: z.string().default('/'),
    afterSignup: z.string().default('/dashboard'),
    afterEmailVerification: z.string().default('/dashboard'),
  }).default({}),

  roles: z.object({
    default: z.string().default('member'),
    available: z.array(z.string()).default(['owner', 'admin', 'member', 'viewer']),
  }).default({}),
})

export type AuthConfig = z.infer<typeof AuthConfigSchema>

export interface User {
  id: string
  email: string
  name: string | null
  avatarUrl: string | null
  emailVerified: boolean
  status: string
  createdAt: Date
  updatedAt: Date
}

export interface Session {
  id: string
  userId: string
  token: string
  expiresAt: Date
  ipAddress: string | null
  userAgent: string | null
  createdAt: Date
}

export interface CreateUserInput {
  email: string
  password?: string
  name?: string
  avatarUrl?: string
  emailVerified?: boolean
}

export interface OAuthAccount {
  id: string
  userId: string
  provider: string
  providerAccountId: string
  accessToken: string | null
  refreshToken: string | null
  expiresAt: Date | null
}

export interface OnUserCreatedArgs {
  user: User
  method: 'email' | 'oauth' | 'magic_link'
}

export interface OnUserDeletedArgs {
  user: User
}

export interface OnAuthSuccessArgs {
  user: User
  method: string
  ip: string | null
}

export interface OnAuthFailureArgs {
  email: string
  reason: string
  ip: string | null
}
