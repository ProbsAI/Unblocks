import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid PostgreSQL URL'),
  DATABASE_SSLMODE: z
    .enum(['disable', 'require'])
    .optional()
    .describe('Set to "disable" to skip SSL for local dev, or "require" to force SSL regardless of NODE_ENV. Production defaults to SSL enabled.'),
  REDIS_URL: z.string().url('REDIS_URL must be a valid Redis URL').optional(),
  APP_URL: z.string().url('APP_URL must be a valid URL'),
  SESSION_SECRET: z
    .string()
    .min(32, 'SESSION_SECRET must be at least 32 characters'),

  ENCRYPTION_KEY: z
    .string()
    .regex(
      /^[0-9a-f]{64}(,[0-9a-f]{64})*$/,
      'ENCRYPTION_KEY must be one or more 64-char hex strings (comma-separated for key rotation). Generate with: openssl rand -hex 32'
    ),

  BLIND_INDEX_KEY: z
    .string()
    .regex(
      /^[0-9a-f]{64}$/,
      'BLIND_INDEX_KEY must be a 64-char hex string. Generate with: openssl rand -hex 32'
    )
    .optional(),

  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  RESEND_API_KEY: z.string().optional(),

  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  UNBLOCKS_LICENSE_KEY: z.string().optional(),
})

export type Env = z.infer<typeof envSchema>

let _env: Env | null = null

export function getEnv(): Env {
  if (_env) return _env

  const result = envSchema.safeParse(process.env)

  if (!result.success) {
    const errors = result.error.flatten().fieldErrors
    const messages = Object.entries(errors)
      .map(([key, msgs]) => `  ${key}: ${(msgs ?? []).join(', ')}`)
      .join('\n')
    throw new Error(
      `Environment variable validation failed:\n${messages}\n\nSee .env.example for required variables.`
    )
  }

  _env = result.data
  return _env
}
