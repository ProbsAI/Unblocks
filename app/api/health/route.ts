import { getPool } from '@unblocks/core/db/client'

export async function GET(): Promise<Response> {
  const checks: Record<string, { status: string; latencyMs?: number }> = {}

  // Check database
  const dbStart = Date.now()
  try {
    const pool = getPool()
    await pool.query('SELECT 1')
    checks.database = { status: 'healthy', latencyMs: Date.now() - dbStart }
  } catch {
    checks.database = { status: 'unhealthy', latencyMs: Date.now() - dbStart }
  }

  const overallStatus = Object.values(checks).every(
    (c) => c.status === 'healthy'
  )
    ? 'healthy'
    : 'degraded'

  return Response.json(
    {
      status: overallStatus,
      version: '0.1.0-alpha',
      uptime: process.uptime(),
      checks,
    },
    { status: overallStatus === 'healthy' ? 200 : 503 }
  )
}
