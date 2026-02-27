'use client'

interface Pipeline {
  id: string
  name: string
  status: string
  lastRun?: Date
}

interface PipelineListProps {
  pipelines: Pipeline[]
}

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  paused: 'bg-yellow-100 text-yellow-800',
  error: 'bg-red-100 text-red-800',
  draft: 'bg-gray-100 text-gray-800',
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function PipelineList({ pipelines }: PipelineListProps) {
  if (pipelines.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-white p-8 text-center">
        <p className="text-muted-foreground">No pipelines yet.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Create your first pipeline to start processing data.
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {pipelines.map((pipeline) => (
        <div
          key={pipeline.id}
          className="rounded-lg border border-border bg-white p-6 shadow-sm"
        >
          <div className="flex items-start justify-between">
            <h3 className="text-sm font-semibold text-foreground">{pipeline.name}</h3>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                statusColors[pipeline.status] ?? 'bg-gray-100 text-gray-800'
              }`}
            >
              {pipeline.status}
            </span>
          </div>
          <div className="mt-3 text-xs text-muted-foreground">
            {pipeline.lastRun ? (
              <span>Last run: {formatDate(new Date(pipeline.lastRun))}</span>
            ) : (
              <span>Never run</span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
