/**
 * Unblocks Core — Public API
 *
 * This is the main entry point for the Unblocks core library.
 * All functions here are framework-agnostic pure TypeScript.
 *
 * Usage:
 *   import { auth, billing, email, db } from '@unblocks/core'
 *   const user = await auth.createUser({ ... })
 *   const plans = billing.getAllPlans()
 */

// AI
export * as ai from './ai/index'

// API Keys
export * as apiKeys from './api-keys/index'

// Auth
export * as auth from './auth/index'

// Billing
export * as billing from './billing/index'

// Email
export * as email from './email/index'

// Database
export { getDb, getPool } from './db/client'
export * as schema from './db/schema/index'

// Config & Runtime
export { loadConfig, getConfig, clearConfigCache } from './runtime/configLoader'
export { registerHook, runHook, runBeforeHook, clearHooks } from './runtime/hookRunner'

// Block Registry
export {
  registerBlock,
  isBlockAvailable,
  tryRequireBlock,
  requireBlock,
  getRegisteredBlocks,
} from './runtime/blockRegistry'

// License
export { validateLicense, hasFeature, getLicenseTier } from './runtime/licenseValidator'

// Environment
export { getEnv } from './env'
export type { Env } from './env'

// API Utilities
export { successResponse, errorResponse } from './api/response'
export { validateBody } from './api/validate'

// Errors
export {
  AppError,
  AuthError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  PlanLimitError,
  RateLimitError,
  ConflictError,
} from './errors/types'
export { toErrorResponse } from './errors/handler'

// Jobs
export * as jobs from './jobs/index'

// Uploads
export * as uploads from './uploads/index'

// Teams
export * as teams from './teams/index'

// Notifications
export * as notifications from './notifications/index'

// Admin
export * as admin from './admin/index'

// Extensions
export * as extensions from './extensions/index'

// UI Resolution
export { resolveUIPath, hasUIOverride } from './runtime/uiResolver'

// Types
export type { ConfigRegistry, ConfigKey, HookName } from './runtime/types'
export type { AppConfig } from './types'
