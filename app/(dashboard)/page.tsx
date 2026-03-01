import { getCurrentUser } from '@/lib/serverAuth'
import { getSubscription } from '@unblocks/core/billing'
import { Card } from '@/components/ui/Card'

export const metadata = { title: 'Dashboard' }

export default async function DashboardPage() {
  const user = await getCurrentUser()
  const subscription = user ? await getSubscription(user.id) : null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your account overview
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <p className="text-sm font-medium text-muted-foreground">Plan</p>
          <p className="mt-2 text-2xl font-bold capitalize text-foreground">
            {subscription?.plan ?? 'Free'}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Status: {subscription?.status ?? 'active'}
          </p>
        </Card>

        <Card>
          <p className="text-sm font-medium text-muted-foreground">Email</p>
          <p className="mt-2 text-lg font-medium text-foreground">
            {user?.email}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {user?.emailVerified ? 'Verified' : 'Not verified'}
          </p>
        </Card>

        <Card>
          <p className="text-sm font-medium text-muted-foreground">
            Member since
          </p>
          <p className="mt-2 text-lg font-medium text-foreground">
            {user?.createdAt
              ? new Date(user.createdAt).toLocaleDateString()
              : 'N/A'}
          </p>
        </Card>
      </div>
    </div>
  )
}
