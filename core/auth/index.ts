export { createUser } from './createUser'
export { verifyCredentials } from './verifyCredentials'
export { createSession } from './createSession'
export { validateSession } from './validateSession'
export type { ValidatedSession } from './validateSession'
export { revokeSession, revokeSessionByToken, revokeAllSessions } from './revokeSession'
export {
  getGoogleAuthUrl,
  exchangeGoogleCode,
  getGoogleUserInfo,
  handleOAuthCallback,
} from './oauth'
export { createMagicLink, verifyMagicLink } from './magicLink'
export { requestPasswordReset, resetPassword } from './passwordReset'
export { createEmailVerificationToken, verifyEmail } from './emailVerification'
export { getUserById, getUserByEmail } from './permissions'
export { checkRateLimit, resetRateLimit } from './rateLimiter'
export type {
  User,
  Session,
  CreateUserInput,
  AuthConfig,
  OnUserCreatedArgs,
  OnUserDeletedArgs,
  OnAuthSuccessArgs,
  OnAuthFailureArgs,
} from './types'
