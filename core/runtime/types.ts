import type { AuthConfig } from '../auth/types'
import type { BillingConfig } from '../billing/types'
import type { EmailConfig } from '../email/types'
import type { JobsConfig } from '../jobs/types'
import type { UploadsConfig } from '../uploads/types'
import type { TeamsConfig } from '../teams/types'
import type { NotificationsConfig } from '../notifications/types'
import type { AppConfig } from '../types'

export interface ConfigRegistry {
  auth: AuthConfig
  billing: BillingConfig
  email: EmailConfig
  jobs: JobsConfig
  uploads: UploadsConfig
  teams: TeamsConfig
  notifications: NotificationsConfig
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
  | 'onJobCompleted'
  | 'onJobFailed'
  | 'onFileUploaded'
  | 'onFileDeleted'
  | 'onTeamCreated'
  | 'onTeamMemberAdded'
  | 'onTeamMemberRemoved'
  | 'onNotificationCreated'
  | 'onError'
  | 'onAICompletion'
  | 'onMarketplaceOrder'

export type HookHandler = (args: unknown) => Promise<unknown>

export interface HookRegistry {
  [hookName: string]: HookHandler[]
}
