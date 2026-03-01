import { listSubscriptions } from '@unblocks/core/admin'
import { Card } from '@/components/ui/Card'

export const metadata = { title: 'Admin - Subscriptions' }

export default async function AdminSubscriptionsPage() {
  const result = await listSubscriptions({ limit: 100 })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Subscriptions</h1>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">User</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Plan</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Interval</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Renews</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Cancel</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {result.subscriptions.map((sub) => (
              <tr key={sub.id}>
                <td className="px-4 py-3 text-foreground">{sub.userEmail}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium capitalize">
                    {sub.plan}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    sub.status === 'active'
                      ? 'bg-success/10 text-success'
                      : 'bg-warning/10 text-warning'
                  }`}>
                    {sub.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {sub.interval ?? '-'}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {sub.currentPeriodEnd
                    ? new Date(sub.currentPeriodEnd).toLocaleDateString()
                    : '-'}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {sub.cancelAtPeriodEnd ? 'Yes' : 'No'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {result.subscriptions.length === 0 ? (
        <Card>
          <div className="py-8 text-center text-muted-foreground">
            No subscriptions found
          </div>
        </Card>
      ) : null}
    </div>
  )
}
