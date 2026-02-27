import { AuthConfigSchema } from '../auth/types'
import { BillingConfigSchema } from '../billing/types'
import { EmailConfigSchema } from '../email/types'
import { JobsConfigSchema } from '../jobs/types'
import { UploadsConfigSchema } from '../uploads/types'
import { TeamsConfigSchema } from '../teams/types'
import { NotificationsConfigSchema } from '../notifications/types'
import { AppConfigSchema } from '../types'
import type { ConfigRegistry, ConfigKey } from './types'
import type { ZodSchema } from 'zod'

const schemas: Record<ConfigKey, ZodSchema> = {
  auth: AuthConfigSchema,
  billing: BillingConfigSchema,
  email: EmailConfigSchema,
  jobs: JobsConfigSchema,
  uploads: UploadsConfigSchema,
  teams: TeamsConfigSchema,
  notifications: NotificationsConfigSchema,
  app: AppConfigSchema,
}

const configCache = new Map<string, unknown>()

export function loadConfig<K extends ConfigKey>(key: K): ConfigRegistry[K] {
  if (configCache.has(key)) {
    return configCache.get(key) as ConfigRegistry[K]
  }

  const schema = schemas[key]
  let userConfig: unknown = {}

  try {
    // Dynamic import of user config files
    // In production, these are resolved at build time
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const configModule = require(`../../config/${key}.config`)
    userConfig = configModule.default ?? configModule
  } catch {
    // No user config file — use all defaults
  }

  const result = schema.safeParse(userConfig)

  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
      .join('\n')
    throw new Error(
      `Config error in ${key}.config.ts:\n${errors}`
    )
  }

  configCache.set(key, result.data)
  return result.data as ConfigRegistry[K]
}

export function getConfig(): ConfigRegistry {
  return {
    auth: loadConfig('auth'),
    billing: loadConfig('billing'),
    email: loadConfig('email'),
    jobs: loadConfig('jobs'),
    uploads: loadConfig('uploads'),
    teams: loadConfig('teams'),
    notifications: loadConfig('notifications'),
    app: loadConfig('app'),
  }
}

export function clearConfigCache(): void {
  configCache.clear()
}
