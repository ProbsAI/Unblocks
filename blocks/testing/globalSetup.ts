import { pushSchema, testDbAvailable, testDatabaseUrl } from './integration'

/**
 * Applies the Drizzle schema to the test database once per integration run.
 *
 * Failing loudly here is deliberate: a silently-unmigrated database is how the
 * ai_usage table came to be referenced by code but created by no migration.
 */
export default async function setup(): Promise<void> {
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
