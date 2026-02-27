/**
 * FIRES: After a failed Stripe payment
 * ARGS:  { userId: string, amount: number, error: string }
 * NOTE:  Runs asynchronously. The subscription may still be active in grace period.
 *
 * COMMON USES:
 *   - Send dunning email
 *   - Alert team in Slack
 *   - Log to error tracking
 */
import type { OnPaymentFailedArgs } from '@unblocks/core/billing/types'

export default async function onPaymentFailed(_args: OnPaymentFailedArgs): Promise<void> {
  // Your custom logic here
}
