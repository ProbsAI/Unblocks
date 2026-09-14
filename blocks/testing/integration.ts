import { execFileSync } from 'node:child_process'
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { sql } from 'drizzle-orm'

/**
 * Integration-test database access.
 *
 * These helpers talk to a REAL Postgres instead of mocking the query builder.
 * That distinction matters: a test that mocks `drizzle-orm` asserts only that
 * you called the functions you said you would, so it cannot catch a wrong
 * column, a missing WHERE, a bad ORDER BY, or a table that was never migrated.
 * Every bug fixed in this area was invisible to the mocked suite.
 *
 * Start the database with:
 *   docker compose up -d postgres_test
 */

const DEFAULT_TEST_URL =
  'postgresql://postgres:password@localhost:5433/unblocks_test'

export function testDatabaseUrl(): string {
  return process.env.DATABASE_URL_TEST ?? DEFAULT_TEST_URL
}

let pool: Pool | undefined

export function getTestDb(): ReturnType<typeof drizzle> {
  if (!pool) {
    pool = new Pool({ connectionString: testDatabaseUrl() })
  }
  return drizzle(pool)
}

export async function closeTestDb(): Promise<void> {
  await pool?.end()
  pool = undefined

  // Also dispose the pool the code under test opened. core/db/client caches its
  // own module-level pg.Pool, so closing only the harness one left live
  // connections and timers behind and could hang vitest teardown.
  try {
    const client: { closeDb?: () => Promise<void> } = await import(
      '@unblocks/core/db/client'
    )
    await client.closeDb?.()
  } catch {
    // The suite may never have touched the core client.
  }
}

/**
 * Apply the current Drizzle schema to the test database.
 *
 * Runs drizzle-kit in a child process with DATABASE_URL pointed at the test
 * instance. Setting the variable here rather than in an npm script keeps this
 * working on Windows, where inline `VAR=value cmd` is not valid.
 */
export function pushSchema(): void {
  execFileSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['drizzle-kit', 'push', '--force'],
    {
      env: { ...process.env, DATABASE_URL: testDatabaseUrl() },
      stdio: 'inherit',
    }
  )
}

/**
 * Empty every application table, preserving structure.
 *
 * Call in beforeEach so each test starts from a known state without paying to
 * recreate the schema. RESTART IDENTITY keeps sequences deterministic; CASCADE
 * handles the foreign keys between users, teams, subscriptions and the rest.
 */
export async function truncateAll(): Promise<void> {
  const db = getTestDb()

  // Derive table names from Postgres itself rather than from the schema object,
  // so a newly added table is cleaned up without anyone remembering to list it.
  const result = await db.execute(sql`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '__drizzle_migrations'
  `)

  const names = (result.rows as Array<{ tablename: string }>).map(
    (r) => r.tablename
  )

  if (names.length === 0) return

  // Build the identifier list with sql.identifier rather than string
  // concatenation. The names come from pg_tables rather than user input, but
  // assembling SQL by interpolation is the pattern static analysis flags and
  // the one that becomes an injection the moment the source changes.
  const identifiers = sql.join(
    names.map((name) => sql.identifier(name)),
    sql`, `
  )

  await db.execute(
    sql`TRUNCATE TABLE ${identifiers} RESTART IDENTITY CASCADE`
  )
}

/**
 * Skip a suite when no test database is reachable, so `npm test` stays green on
 * a machine that has not started Docker. CI should set DATABASE_URL_TEST and
 * treat a skip as a failure.
 */
export async function testDbAvailable(): Promise<boolean> {
  const probe = new Pool({
    connectionString: testDatabaseUrl(),
    connectionTimeoutMillis: 2000,
  })
  try {
    await probe.query('SELECT 1')
    return true
  } catch {
    return false
  } finally {
    // Close on both paths; a probe that failed still holds pool timers.
    await probe.end().catch(() => {})
  }
}
