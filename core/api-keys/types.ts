import { z } from 'zod'

export interface ApiKey {
  id: string
  userId: string
  teamId: string | null
  name: string
  prefix: string
  scopes: string[]
  lastUsedAt: Date | null
  expiresAt: Date | null
  revokedAt: Date | null
  createdAt: Date
}

export interface CreateApiKeyResult {
  /** The full API key — shown ONCE, never retrievable again */
  key: string
  apiKey: ApiKey
}

export const CreateApiKeySchema = z.object({
  name: z.string().min(1).max(255),
  teamId: z.string().uuid().optional(),
  scopes: z.array(z.string()).default(['*']),
  expiresInDays: z.number().positive().optional(),
})

/**
 * Caller-facing shape. Uses z.input rather than z.infer so `scopes` stays
 * optional: the schema supplies the default, and createApiKey falls back to
 * ['*'] itself. z.infer describes the parsed OUTPUT, where the default has
 * already been applied and the field is therefore required.
 */
export type CreateApiKeyInput = z.input<typeof CreateApiKeySchema>

export const API_KEY_PREFIX = 'ub_live_'
