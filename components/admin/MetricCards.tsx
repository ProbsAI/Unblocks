import { Card } from '@/components/ui/Card'
import type { AdminMetrics } from '@unblocks/core/admin/types'

interface MetricCardsProps {
  metrics: AdminMetrics
}

export function MetricCards({ metrics }: MetricCardsProps) {
  const cards = [
    { label: 'Total Users', value: metrics.totalUsers.toLocaleString() },
    { label: 'Active (30d)', value: metrics.activeUsers30d.toLocaleString() },
    { label: 'Paid Subscriptions', value: metrics.paidSubscriptions.toLocaleString() },
    { label: 'MRR', value: `$${metrics.mrr.toLocaleString()}` },
    { label: 'Total Teams', value: metrics.totalTeams.toLocaleString() },
    { label: 'Total Subscriptions', value: metrics.totalSubscriptions.toLocaleString() },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => (
        <Card key={card.label}>
          <p className="text-sm font-medium text-muted-foreground">
            {card.label}
          </p>
          <p className="mt-2 text-3xl font-bold text-foreground">
            {card.value}
          </p>
        </Card>
      ))}
    </div>
  )
}
