import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Pool } from 'pg'

// Mock pg Pool to capture constructor args
vi.mock('pg', () => {
  const MockPool = vi.fn()
  return { Pool: MockPool }
})

vi.mock('drizzle-orm/node-postgres', () => ({
  drizzle: vi.fn().mockReturnValue({ query: {} }),
}))

// We need to re-import after each test to clear the singleton
let getPool: typeof import('../db/client').getPool
let getDb: typeof import('../db/client').getDb

describe('getPool SSL configuration', () => {
  const originalEnv = process.env

  beforeEach(async () => {
    // Reset modules to clear singleton _pool
    vi.resetModules()
    process.env = { ...originalEnv }
    process.env.DATABASE_URL = 'postgresql://localhost:5432/test'
    const mod = await import('../db/client')
    getPool = mod.getPool
    getDb = mod.getDb
    vi.mocked(Pool).mockClear()
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('enforces SSL with rejectUnauthorized=true in production', () => {
    (process.env as Record<string, string>).NODE_ENV ='production'

    getPool()

    expect(Pool).toHaveBeenCalledWith(
      expect.objectContaining({
        ssl: { rejectUnauthorized: true },
      })
    )
  })

  it('does not set SSL in development by default', () => {
    (process.env as Record<string, string>).NODE_ENV ='development'

    getPool()

    expect(Pool).toHaveBeenCalledWith(
      expect.objectContaining({
        ssl: undefined,
      })
    )
  })

  it('disables SSL when DATABASE_SSLMODE=disable even in production', () => {
    (process.env as Record<string, string>).NODE_ENV ='production'
    process.env.DATABASE_SSLMODE = 'disable'

    getPool()

    expect(Pool).toHaveBeenCalledWith(
      expect.objectContaining({
        ssl: false,
      })
    )
  })

  it('returns the same pool instance on subsequent calls', () => {
    (process.env as Record<string, string>).NODE_ENV ='development'

    const pool1 = getPool()
    const pool2 = getPool()

    expect(pool1).toBe(pool2)
    expect(Pool).toHaveBeenCalledTimes(1)
  })
})

describe('getDb', () => {
  it('returns a drizzle instance', () => {
    const db = getDb()

    expect(db).toBeDefined()
    expect(db).toHaveProperty('query')
  })

  it('returns the same instance on subsequent calls', () => {
    const db1 = getDb()
    const db2 = getDb()

    expect(db1).toBe(db2)
  })
})
