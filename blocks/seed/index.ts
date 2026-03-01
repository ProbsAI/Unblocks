/**
 * Seed Block — Public API
 */
export { seed } from './seed'
export { SeedConfigSchema } from './types'
export type { SeedConfig, SeedResult } from './types'
export {
  generateEmail,
  generateUserName,
  generateTeamName,
  generateTeamSlug,
  generateJobType,
  generateNotificationTitle,
  generateFileName,
  resetSeedCounter,
} from './generators'
