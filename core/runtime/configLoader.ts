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

// Static imports, not require(). This module previously resolved user config
// with require() inside a try/catch; in an ESM runtime require is not defined,
// so the call threw on EVERY key and the catch silently substituted {} —
// meaning every config/*.config.ts file was ignored and the app ran entirely on
// schema defaults. Because the fallback is silent by construction, nothing
// surfaced it: the same failure shape that made core/ai read no config at all.
//
// A static map keeps the loader's by-key API while letting the bundler resolve
// the modules properly. A new config file must be registered here as well as in
// `schemas` below.
import authConfig from '../../config/auth.config'
import billingConfig from '../../config/billing.config'
import emailConfig from '../../config/email.config'
import jobsConfig from '../../config/jobs.config'
import uploadsConfig from '../../config/uploads.config'
import teamsConfig from '../../config/teams.config'
import notificationsConfig from '../../config/notifications.config'
import appConfig from '../../config/app.config'

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

const userConfigs: Record<ConfigKey, unknown> = {
  auth: authConfig,
  billing: billingConfig,
  email: emailConfig,
  jobs: jobsConfig,
  uploads: uploadsConfig,
  teams: teamsConfig,
  notifications: notificationsConfig,
  app: appConfig,
}

const configCache = new Map<string, unknown>()

export function loadConfig<K extends ConfigKey>(key: K): ConfigRegistry[K] {
  if (configCache.has(key)) {
    return configCache.get(key) as ConfigRegistry[K]
  }

  const schema = schemas[key]
  const userConfig = userConfigs[key] ?? {}

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
