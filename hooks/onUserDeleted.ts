/**
 * FIRES: After a user account is deleted
 * ARGS:  { user: User }
 * NOTE:  Runs asynchronously. The user record may already be gone from the DB.
 *
 * COMMON USES:
 *   - Cleanup external resources
 *   - GDPR compliance notifications
 *   - Notify admins
 */
import type { OnUserDeletedArgs } from '@unblocks/core/auth/types'

export default async function onUserDeleted(_args: OnUserDeletedArgs): Promise<void> {
  // Your custom logic here
}
