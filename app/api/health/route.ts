import { getPool } from '@unblocks/core/db/client'
import { assertPiiStorageMatchesData } from '@unblocks/core/security'

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

  // privacy.encryptUserEmail decides which column holds an address, so a
  // deployment whose config disagrees with its data cannot look anyone up. That
  // failure is otherwise completely silent — sign-in just stops matching — so
  // surface it here, where an operator is already looking.
  try {
    await assertPiiStorageMatchesData()
    checks.piiStorage = { status: 'healthy' }
  } catch {
    checks.piiStorage = { status: 'unhealthy' }
  }

  const overallStatus = Object.values(checks).every(
    (c) => c.status === 'healthy'
  )
    ? 'healthy'
    : 'degraded'

  return Response.json(
    {
      status: overallStatus,
      version: process.env.npm_package_version ?? '0.2.0-alpha',
      uptime: process.uptime(),
      checks,
    },
    { status: overallStatus === 'healthy' ? 200 : 503 }
  )
}
