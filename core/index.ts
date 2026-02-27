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

// Types
export type { ConfigRegistry, ConfigKey, HookName } from './runtime/types'
export type { AppConfig } from './types'
