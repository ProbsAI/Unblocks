import { execFileSync } from 'node:child_process'
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { sql } from 'drizzle-orm'
import { users } from '@unblocks/core/db/schema/users'
import { emailColumns } from '@unblocks/core/security/piiStorage'

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
 * Insert a user the way the application would, and return its id.
 *
 * Use this instead of `INSERT INTO users (email, ...)`. Which column holds an
 * address is decided by `privacy.encryptUserEmail`, so a raw insert naming
 * `email` writes a plaintext row that the running mode cannot look up — every
 * suite that seeded that way started failing the moment encrypted mode became
 * the default, and the failure looked like a broken query rather than a broken
 * fixture. Going through `emailColumns` keeps a fixture correct in either mode,
 * which is also what makes these suites meaningful coverage of both.
 *
 * Defaults are "an ordinary, usable account": verified, named after its
 * address, no password. Pass `emailVerified: false` when the unverified state
 * is the thing under test.
 */
export async function seedUser(user: {
  email: string
  name?: string | null
  emailVerified?: boolean
  passwordHash?: string | null
}): Promise<string> {
  const db = getTestDb()

  const [row] = await db
    .insert(users)
    .values({
      ...emailColumns(user.email),
      name: user.name ?? user.email,
      emailVerified: user.emailVerified ?? true,
      passwordHash: user.passwordHash ?? null,
    })
    .returning({ id: users.id })

  return row.id
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
