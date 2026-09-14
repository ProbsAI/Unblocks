import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import { sql } from 'drizzle-orm'
import { getTestDb, truncateAll, closeTestDb, testDatabaseUrl } from '@unblocks/blocks/testing/integration'

/**
 * Regression tests for job claiming, against a real Postgres.
 *
 * The ordering bug these cover — `ORDER BY priority ASC` on a varchar column,
 * which sorts high, low, normal alphabetically and runs low-priority work ahead
 * of normal — was invisible to the mocked suite by construction: mocking the
 * query builder cannot evaluate an ORDER BY.
 */

beforeAll(() => {
  process.env.DATABASE_URL = testDatabaseUrl()
})

afterAll(async () => {
  await closeTestDb()
})

beforeEach(async () => {
  await truncateAll()
})

async function seedJob(
  type: string,
  priority: 'critical' | 'high' | 'normal' | 'low',
  scheduledAt = new Date(Date.now() - 1000)
): Promise<void> {
  const db = getTestDb()
  await db.execute(sql`
    INSERT INTO jobs (type, payload, status, priority, scheduled_at)
    VALUES (${type}, ${'{}'}::jsonb, 'pending', ${priority}, ${scheduledAt.toISOString()})
  `)
}

describe('fetchNextJobs — priority ordering', () => {
  it('claims high before normal before low', async () => {
    // Insert in an order that would pass if sorting were alphabetical, so a
    // regression cannot hide behind insertion order.
    await seedJob('low-job', 'low')
    await seedJob('high-job', 'high')
    await seedJob('normal-job', 'normal')

    const { fetchNextJobs } = await import('./queue')
    const claimed = await fetchNextJobs(3)

    expect(claimed.map((j) => j.type)).toEqual([
      'high-job',
      'normal-job',
      'low-job',
    ])
  })

  it('does not let a low-priority job precede a normal one', async () => {
    // The precise shape of the original bug: alphabetically 'low' < 'normal'.
    await seedJob('normal-job', 'normal')
    await seedJob('low-job', 'low')

    const { fetchNextJobs } = await import('./queue')
    const claimed = await fetchNextJobs(1)

    expect(claimed).toHaveLength(1)
    expect(claimed[0].type).toBe('normal-job')
  })

  it('runs critical ahead of high', async () => {
    // 'critical' is part of JobPriority but was absent from the CASE, so it fell
    // through to the default rank and tied with 'normal'.
    await seedJob('high-job', 'high')
    await seedJob('critical-job', 'critical')

    const { fetchNextJobs } = await import('./queue')
    const claimed = await fetchNextJobs(2)

    expect(claimed.map((j) => j.type)).toEqual(['critical-job', 'high-job'])
  })

  it('breaks ties by scheduled_at, oldest first', async () => {
    const older = new Date(Date.now() - 60_000)
    const newer = new Date(Date.now() - 1_000)
    await seedJob('newer', 'normal', newer)
    await seedJob('older', 'normal', older)

    const { fetchNextJobs } = await import('./queue')
    const claimed = await fetchNextJobs(2)

    expect(claimed.map((j) => j.type)).toEqual(['older', 'newer'])
  })
})

describe('fetchNextJobs — claiming semantics', () => {
  it('marks claimed jobs as processing so a second call cannot re-claim them', async () => {
    await seedJob('only-job', 'normal')

    const { fetchNextJobs } = await import('./queue')
    const first = await fetchNextJobs(10)
    const second = await fetchNextJobs(10)

    expect(first).toHaveLength(1)
    expect(first[0].status).toBe('processing')
    expect(second).toHaveLength(0)
  })

  it('ignores jobs scheduled in the future', async () => {
    await seedJob('future', 'high', new Date(Date.now() + 600_000))
    await seedJob('ready', 'low')

    const { fetchNextJobs } = await import('./queue')
    const claimed = await fetchNextJobs(10)

    expect(claimed.map((j) => j.type)).toEqual(['ready'])
  })

  it('respects the limit', async () => {
    await seedJob('a', 'normal')
    await seedJob('b', 'normal')
    await seedJob('c', 'normal')

    const { fetchNextJobs } = await import('./queue')
    const claimed = await fetchNextJobs(2)

    expect(claimed).toHaveLength(2)
  })
})
