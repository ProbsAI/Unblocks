import { getCurrentUser } from '@/lib/serverAuth'
import { redirect } from 'next/navigation'
import { isBlockAvailable } from '@unblocks/core/runtime/blockRegistry'
import { Card } from '@/components/ui/Card'
import { UsageChart } from '@/components/ai/UsageChart'

export const metadata = { title: 'AI Usage' }

const mockUsageByProvider = [
  { provider: 'OpenAI', requests: 1243, tokens: 482_000 },
  { provider: 'Anthropic', requests: 876, tokens: 315_000 },
  { provider: 'Google', requests: 204, tokens: 98_000 },
]

const mockCompletions = [
  { id: '1', model: 'gpt-4o', tokens: 1820, cost: 0.054, createdAt: '2 min ago' },
  { id: '2', model: 'claude-3-sonnet', tokens: 943, cost: 0.028, createdAt: '8 min ago' },
  { id: '3', model: 'gpt-4o', tokens: 2105, cost: 0.063, createdAt: '15 min ago' },
  { id: '4', model: 'gemini-pro', tokens: 612, cost: 0.012, createdAt: '22 min ago' },
  { id: '5', model: 'claude-3-sonnet', tokens: 1547, cost: 0.046, createdAt: '31 min ago' },
]

export default async function AIPage() {
  await getCurrentUser()

  if (!isBlockAvailable('ai-wrapper')) {
    redirect('/dashboard?block=ai-wrapper&status=not-installed')
  }

  const totalRequests = mockUsageByProvider.reduce((sum, p) => sum + p.requests, 0)
  const totalTokens = mockUsageByProvider.reduce((sum, p) => sum + p.tokens, 0)
  const estimatedCost = mockCompletions.reduce((sum, c) => sum + c.cost, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">AI Usage</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Monitor AI requests, token consumption, and estimated costs
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <p className="text-sm font-medium text-muted-foreground">Total Requests</p>
          <p className="mt-2 text-3xl font-bold text-foreground">
            {totalRequests.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Last 30 days</p>
        </Card>

        <Card>
          <p className="text-sm font-medium text-muted-foreground">Tokens Used</p>
          <p className="mt-2 text-3xl font-bold text-foreground">
            {totalTokens.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Last 30 days</p>
        </Card>

        <Card>
          <p className="text-sm font-medium text-muted-foreground">Estimated Cost</p>
          <p className="mt-2 text-3xl font-bold text-foreground">
            ${estimatedCost.toFixed(2)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Last 30 days</p>
        </Card>
      </div>

      <Card>
        <h2 className="mb-4 text-lg font-semibold text-foreground">Usage by Provider</h2>
        <UsageChart data={mockUsageByProvider} />
      </Card>

      <Card>
        <h2 className="mb-4 text-lg font-semibold text-foreground">Recent Completions</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="pb-3 pr-4 font-medium">Model</th>
                <th className="pb-3 pr-4 font-medium">Tokens</th>
                <th className="pb-3 pr-4 font-medium">Cost</th>
                <th className="pb-3 font-medium">Time</th>
              </tr>
            </thead>
            <tbody>
              {mockCompletions.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0">
                  <td className="py-3 pr-4 font-medium text-foreground">{c.model}</td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {c.tokens.toLocaleString()}
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">${c.cost.toFixed(3)}</td>
                  <td className="py-3 text-muted-foreground">{c.createdAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
