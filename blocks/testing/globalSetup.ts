import { pushSchema, testDbAvailable, testDatabaseUrl } from './integration'

/**
 * Applies the Drizzle schema to the test database once per integration run.
 *
 * Failing loudly here is deliberate: a silently-unmigrated database is how the
 * ai_usage table came to be referenced by code but created by no migration.
 */
export default async function setup(): Promise<void> {
  // Force the code under test onto the throwaway instance. blocks/testing/setup.ts
  // defaults DATABASE_URL to port 5432, so a suite that forgot to override it
  // would truncate via the 5433 harness while exercising a different database.
  process.env.DATABASE_URL = testDatabaseUrl()

  if (!(await waitForTestDb())) {
    throw new Error(
      [
        `No test database reachable at ${testDatabaseUrl()} after ${READY_TIMEOUT_MS / 1000}s`,
        '',
        'Start one with:  docker compose up -d postgres_test',
        'Or point DATABASE_URL_TEST at your own throwaway database.',
      ].join('\n')
    )
  }

  pushSchema()
}

const READY_TIMEOUT_MS = 30_000
const RETRY_INTERVAL_MS = 500

/**
 * Wait for Postgres to accept connections, up to a bounded deadline.
 *
 * A single probe made the documented workflow — `docker compose up -d
 * postgres_test` followed immediately by the test run — fail whenever the
 * container was still starting, which on a first image pull it always is. CI
 * hides that behind a service health check; locally it just looked broken.
 *
 * Bounded rather than open-ended so a genuinely absent database still fails,
 * and reasonably fast, instead of hanging the run.
 */
async function waitForTestDb(): Promise<boolean> {
  const deadline = Date.now() + READY_TIMEOUT_MS

  for (;;) {
    if (await testDbAvailable()) return true
    if (Date.now() >= deadline) return false
    await new Promise((resolve) => setTimeout(resolve, RETRY_INTERVAL_MS))
  }
}
