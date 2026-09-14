import { getCurrentUser } from '@/lib/serverAuth'
import { getSubscription } from '@unblocks/core/billing'
import { Card } from '@/components/ui/Card'

export const metadata = { title: 'Dashboard' }

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ signed_in_via?: string }>
}) {
  const user = await getCurrentUser()
  const subscription = user ? await getSubscription(user.id) : null
  const { signed_in_via: signedInVia } = await searchParams

  return (
    <div className="space-y-6">
      {/*
        Name the account after a magic-link sign-in. The confirmation
        interstitial is what actually stops a planted link from signing someone
        into an attacker's account; this is the backstop for anyone who clicked
        through it without reading, and for deployments that turned
        requireConfirmation off.
      */}
      {signedInVia === 'magic_link' && user ? (
        <div className="rounded-md border border-border bg-muted/50 p-4">
          <p className="text-sm text-foreground">
            You signed in via magic link as{' '}
            <span className="font-medium break-all">{user.email}</span>.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Not your account? Sign out before entering any personal or payment
            details.
          </p>
        </div>
      ) : null}

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
