'use client'

interface UsageChartProps {
  data: Array<{ provider: string; requests: number; tokens: number }>
}

export function UsageChart({ data }: UsageChartProps) {
  const maxRequests = Math.max(...data.map((d) => d.requests))
  const maxTokens = Math.max(...data.map((d) => d.tokens))

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-3 text-sm font-medium text-muted-foreground">Requests</h3>
        <div className="space-y-3">
          {data.map((item) => {
            const widthPercent = maxRequests > 0 ? (item.requests / maxRequests) * 100 : 0
            return (
              <div key={`requests-${item.provider}`} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground">{item.provider}</span>
                  <span className="text-muted-foreground">
                    {item.requests.toLocaleString()}
                  </span>
                </div>
                <div className="h-3 w-full rounded-full bg-muted">
                  <div
                    className="h-3 rounded-full bg-primary transition-all"
                    style={{ width: `${widthPercent}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-medium text-muted-foreground">Tokens</h3>
        <div className="space-y-3">
          {data.map((item) => {
            const widthPercent = maxTokens > 0 ? (item.tokens / maxTokens) * 100 : 0
            return (
              <div key={`tokens-${item.provider}`} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground">{item.provider}</span>
                  <span className="text-muted-foreground">
                    {item.tokens.toLocaleString()}
                  </span>
                </div>
                <div className="h-3 w-full rounded-full bg-muted">
                  <div
                    className="h-3 rounded-full bg-primary/70 transition-all"
                    style={{ width: `${widthPercent}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
