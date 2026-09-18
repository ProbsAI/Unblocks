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

/**
 * A lease long enough that nothing is ever reclaimed mid-test. These cases are
 * about which rows get claimed and in what order; reclamation has its own case
 * below and sets its own lease.
 */
const LEASE_MS = 60 * 60 * 1000

describe('fetchNextJobs — priority ordering', () => {
  it('claims high before normal before low', async () => {
    // Insert in an order that would pass if sorting were alphabetical, so a
    // regression cannot hide behind insertion order.
    await seedJob('low-job', 'low')
    await seedJob('high-job', 'high')
    await seedJob('normal-job', 'normal')

    const { fetchNextJobs } = await import('./queue')
    const claimed = await fetchNextJobs(3, LEASE_MS)

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
    const claimed = await fetchNextJobs(1, LEASE_MS)

    expect(claimed).toHaveLength(1)
    expect(claimed[0].type).toBe('normal-job')
  })

  it('runs critical ahead of high', async () => {
    // 'critical' is part of JobPriority but was absent from the CASE, so it fell
    // through to the default rank and tied with 'normal'.
    await seedJob('high-job', 'high')
    await seedJob('critical-job', 'critical')

    const { fetchNextJobs } = await import('./queue')
    const claimed = await fetchNextJobs(2, LEASE_MS)

    expect(claimed.map((j) => j.type)).toEqual(['critical-job', 'high-job'])
  })

  it('breaks ties by scheduled_at, oldest first', async () => {
    const older = new Date(Date.now() - 60_000)
    const newer = new Date(Date.now() - 1_000)
    await seedJob('newer', 'normal', newer)
    await seedJob('older', 'normal', older)

    const { fetchNextJobs } = await import('./queue')
    const claimed = await fetchNextJobs(2, LEASE_MS)

    expect(claimed.map((j) => j.type)).toEqual(['older', 'newer'])
  })
})

describe('fetchNextJobs — claiming semantics', () => {
  it('marks claimed jobs as processing so a second call cannot re-claim them', async () => {
    await seedJob('only-job', 'normal')

    const { fetchNextJobs } = await import('./queue')
    const first = await fetchNextJobs(10, LEASE_MS)
    const second = await fetchNextJobs(10, LEASE_MS)

    expect(first).toHaveLength(1)
    expect(first[0].status).toBe('processing')
    expect(second).toHaveLength(0)
  })

  it('ignores jobs scheduled in the future', async () => {
    await seedJob('future', 'high', new Date(Date.now() + 600_000))
    await seedJob('ready', 'low')

    const { fetchNextJobs } = await import('./queue')
    const claimed = await fetchNextJobs(10, LEASE_MS)

    expect(claimed.map((j) => j.type)).toEqual(['ready'])
  })

  it('respects the limit', async () => {
    await seedJob('a', 'normal')
    await seedJob('b', 'normal')
    await seedJob('c', 'normal')

    const { fetchNextJobs } = await import('./queue')
    const claimed = await fetchNextJobs(2, LEASE_MS)

    expect(claimed).toHaveLength(2)
  })
})

describe('reclaiming abandoned jobs', () => {
  it('re-claims a processing row whose lease has expired', async () => {
    // A worker that dies mid-job leaves its row in 'processing'. Claiming only
    // looked at 'pending', so that row was never touched again — the job was
    // simply lost, with no error anywhere.
    const { fetchNextJobs } = await import('./queue')
    const db = getTestDb()
    await db.execute(sql`
      INSERT INTO jobs (type, payload, status, priority, started_at)
      VALUES ('abandoned', '{}'::jsonb, 'processing', 'normal',
              NOW() - INTERVAL '10 minutes')
    `)

    const claimed = await fetchNextJobs(10, 60_000)

    expect(claimed).toHaveLength(1)
    expect(claimed[0].type).toBe('abandoned')
  })

  it('leaves a processing row alone while its lease holds', async () => {
    // The other direction matters just as much: reclaiming a job whose worker
    // is merely slow runs it twice. The lease has to be longer than the job
    // timeout, which is why the worker passes a multiple of it.
    const { fetchNextJobs } = await import('./queue')
    const db = getTestDb()
    await db.execute(sql`
      INSERT INTO jobs (type, payload, status, priority, started_at)
      VALUES ('still-running', '{}'::jsonb, 'processing', 'normal', NOW())
    `)

    expect(await fetchNextJobs(10, 60_000)).toHaveLength(0)
  })
})
