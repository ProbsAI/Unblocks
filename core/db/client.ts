import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema/index'

let _pool: Pool | null = null
let _db: ReturnType<typeof drizzle> | null = null

export function getPool(): Pool {
  if (!_pool) {
    const isProduction = process.env.NODE_ENV === 'production'

    _pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      // Enforce SSL in production to encrypt data in transit to the database.
      // Cloud providers (AWS RDS, GCP Cloud SQL, etc.) support this natively.
      // Set DATABASE_SSLMODE=disable to explicitly opt out (e.g. local dev).
      ssl:
        process.env.DATABASE_SSLMODE === 'disable'
          ? false
          : process.env.DATABASE_SSLMODE === 'require' || isProduction
            ? { rejectUnauthorized: true }
            : undefined,
    })
  }
  return _pool
}

export function getDb() {
  if (!_db) {
    _db = drizzle(getPool(), { schema })
  }
  return _db
}
