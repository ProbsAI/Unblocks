import type { AuthConfig } from '../auth/types'
import type { BillingConfig } from '../billing/types'
import type { EmailConfig } from '../email/types'
import type { AppConfig } from '../types'

export interface ConfigRegistry {
  auth: AuthConfig
  billing: BillingConfig
  email: EmailConfig
  app: AppConfig
}

export type ConfigKey = keyof ConfigRegistry

export type HookName =
  | 'onUserCreated'
  | 'onUserDeleted'
  | 'onPaymentSucceeded'
  | 'onPaymentFailed'
  | 'onSubscriptionChanged'
  | 'onAuthSuccess'
  | 'onAuthFailure'
  | 'beforeEmailSend'
  | 'onError'

export type HookHandler = (args: unknown) => Promise<unknown>

export interface HookRegistry {
  [hookName: string]: HookHandler[]
}
