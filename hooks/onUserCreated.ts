/**
 * FIRES: After a new user is created (registration, OAuth, magic link)
 * ARGS:  { user: User, method: 'email' | 'oauth' | 'magic_link' }
 * NOTE:  Runs asynchronously — the user is already created when this fires.
 *        Errors here are logged but don't affect the user's registration.
 *
 * COMMON USES:
 *   - Sync user to CRM (HubSpot, Salesforce)
 *   - Send welcome Slack notification
 *   - Create default workspace/project
 *   - Track signup event in analytics
 *   - Start onboarding drip campaign
 */
import type { OnUserCreatedArgs } from '@unblocks/core/auth/types'

export default async function onUserCreated(_args: OnUserCreatedArgs): Promise<void> {
  // Your custom logic here
}
