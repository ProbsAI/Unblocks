import { getCurrentUser } from '@/lib/serverAuth'
import { getSubscription, getAllPlans } from '@unblocks/core/billing'
import { Card } from '@/components/ui/Card'
import { PricingTable } from '@/components/billing/PricingTable'
import { ManageSubscription } from '@/components/billing/ManageSubscription'

export const metadata = { title: 'Billing' }

export default async function BillingPage() {
  const user = await getCurrentUser()
  const subscription = user ? await getSubscription(user.id) : null
  const plans = getAllPlans()

  const currentPlan = subscription?.plan ?? 'free'
  const isPaid = currentPlan !== 'free'

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Billing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your subscription and billing details
        </p>
      </div>

      <Card>
        <h2 className="text-lg font-semibold text-foreground">
          Current Plan
        </h2>
        <div className="mt-4 flex items-baseline gap-3">
          <span className="text-3xl font-bold capitalize text-foreground">
            {currentPlan}
          </span>
          {subscription?.status ? (
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              subscription.status === 'active'
                ? 'bg-success/10 text-success'
                : subscription.status === 'trialing'
                ? 'bg-warning/10 text-warning'
                : 'bg-destructive/10 text-destructive'
            }`}>
              {subscription.status}
            </span>
          ) : (
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              active
            </span>
          )}
        </div>

        {subscription?.currentPeriodEnd ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {subscription.cancelAtPeriodEnd
              ? `Cancels on ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`
              : `Renews on ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`}
          </p>
        ) : null}

        {subscription?.trialEnd ? (
          <p className="mt-1 text-sm text-muted-foreground">
            Trial ends {new Date(subscription.trialEnd).toLocaleDateString()}
          </p>
        ) : null}

        {isPaid ? (
          <div className="mt-4">
            <ManageSubscription />
          </div>
        ) : null}
      </Card>

      <div>
        <h2 className="mb-4 text-lg font-semibold text-foreground">
          {isPaid ? 'Change Plan' : 'Upgrade Your Plan'}
        </h2>
        <PricingTable plans={plans} currentPlan={currentPlan} />
      </div>
    </div>
  )
}
