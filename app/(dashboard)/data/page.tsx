import { getCurrentUser } from '@/lib/serverAuth'
import { Card } from '@/components/ui/Card'
import { PipelineList } from '@/components/data/PipelineList'

export const metadata = { title: 'Data Platform' }

const mockPipelines = [
  { id: '1', name: 'User Analytics ETL', status: 'active', lastRun: new Date('2026-02-27T10:30:00') },
  { id: '2', name: 'Product Catalog Sync', status: 'active', lastRun: new Date('2026-02-27T09:15:00') },
  { id: '3', name: 'Email Campaign Data', status: 'paused', lastRun: new Date('2026-02-25T14:00:00') },
  { id: '4', name: 'Revenue Aggregation', status: 'error', lastRun: new Date('2026-02-26T18:45:00') },
  { id: '5', name: 'Customer Segmentation', status: 'draft' },
]

const mockDatasets = [
  { id: '1', name: 'users_enriched', rows: 24_530, size: '12.4 MB', updatedAt: '2 hours ago' },
  { id: '2', name: 'product_catalog_v3', rows: 8_712, size: '3.2 MB', updatedAt: '5 hours ago' },
  { id: '3', name: 'monthly_revenue', rows: 365, size: '128 KB', updatedAt: '1 day ago' },
  { id: '4', name: 'email_engagement', rows: 102_440, size: '45.1 MB', updatedAt: '3 days ago' },
]

export default async function DataPage() {
  await getCurrentUser()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Data Platform</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your data pipelines and datasets
        </p>
      </div>

      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Pipelines</h2>
          <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover">
            Create Pipeline
          </button>
        </div>
        <PipelineList pipelines={mockPipelines} />
      </div>

      <Card>
        <h2 className="mb-4 text-lg font-semibold text-foreground">Datasets</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="pb-3 pr-4 font-medium">Name</th>
                <th className="pb-3 pr-4 font-medium">Rows</th>
                <th className="pb-3 pr-4 font-medium">Size</th>
                <th className="pb-3 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody>
              {mockDatasets.map((ds) => (
                <tr key={ds.id} className="border-b border-border last:border-0">
                  <td className="py-3 pr-4 font-medium text-foreground">{ds.name}</td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {ds.rows.toLocaleString()}
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">{ds.size}</td>
                  <td className="py-3 text-muted-foreground">{ds.updatedAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
