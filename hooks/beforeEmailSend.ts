/**
 * FIRES: Before any email is sent
 * ARGS:  EmailHookArgs { to, from, subject, html, headers }
 * RETURNS: Modified EmailHookArgs (or original if unchanged)
 * NOTE:  This is a "before" hook — the return value replaces the original args.
 *
 * COMMON USES:
 *   - Add tracking pixel
 *   - Modify subject line (e.g., add brand prefix)
 *   - Add custom headers
 *   - Filter or block certain emails
 */
import type { EmailHookArgs } from '@unblocks/core/email/types'

export default async function beforeEmailSend(args: EmailHookArgs): Promise<EmailHookArgs> {
  // Modify email before sending
  return args
}
