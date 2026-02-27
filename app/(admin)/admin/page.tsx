import { getMetrics } from '@unblocks/core/admin'
import { MetricCards } from '@/components/admin/MetricCards'

export const metadata = { title: 'Admin Dashboard' }

export default async function AdminPage() {
  const metrics = await getMetrics()

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
      <MetricCards metrics={metrics} />
    </div>
  )
}
