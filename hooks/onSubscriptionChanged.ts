/**
 * FIRES: After a subscription is created, upgraded, downgraded, or canceled
 * ARGS:  { userId: string, oldPlan: string, newPlan: string, subscription: Subscription }
 * NOTE:  Runs asynchronously after the Stripe webhook updates the local subscription.
 *
 * COMMON USES:
 *   - Adjust feature access
 *   - Send plan change confirmation email
 *   - Update CRM
 *   - Log for analytics
 */
import type { OnSubscriptionChangedArgs } from '@unblocks/core/billing/types'

export default async function onSubscriptionChanged(
  _args: OnSubscriptionChangedArgs
): Promise<void> {
  // Your custom logic here
}
