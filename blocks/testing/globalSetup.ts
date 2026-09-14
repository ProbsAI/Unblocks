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

  if (!(await testDbAvailable())) {
    throw new Error(
      [
        `No test database reachable at ${testDatabaseUrl()}`,
        '',
        'Start one with:  docker compose up -d postgres_test',
        'Or point DATABASE_URL_TEST at your own throwaway database.',
      ].join('\n')
    )
  }

  pushSchema()
}
