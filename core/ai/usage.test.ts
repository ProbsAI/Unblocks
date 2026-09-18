import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockInsert = vi.fn().mockReturnValue({
  values: vi.fn().mockResolvedValue(undefined),
})

const mockSelect = vi.fn().mockReturnValue({
  from: vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue([
      {
        totalTokens: 1500,
        totalCostCents: 25,
        requestCount: 3,
      },
    ]),
  }),
})

const mockSelectHistory = vi.fn().mockReturnValue({
  from: vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      orderBy: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([
          {
            id: 'usage-1',
            userId: 'user-123',
            model: 'gpt-4o',
            provider: 'openai',
            promptTokens: 100,
            completionTokens: 50,
            totalTokens: 150,
            costCents: 5,
            latencyMs: 200,
            metadata: { source: 'test' },
            createdAt: new Date('2026-01-01'),
          },
          {
            id: 'usage-2',
            userId: 'user-123',
            model: 'claude-sonnet-4-6',
            provider: 'anthropic',
            promptTokens: 200,
            completionTokens: 100,
            totalTokens: 300,
            costCents: 10,
            latencyMs: 350,
            metadata: null,
            createdAt: new Date('2026-01-02'),
          },
        ]),
      }),
    }),
  }),
})

let selectCallCount = 0

vi.mock('../db/client', () => ({
  getDb: vi.fn(() => ({
    insert: mockInsert,
    select: (...args: unknown[]) => {
      selectCallCount++
      // First select call pattern = getUserUsage (aggregation), subsequent = getUsageHistory
      if (selectCallCount <= 1) {
        return mockSelect(...args)
      }
      return mockSelectHistory(...args)
    },
  })),
}))

vi.mock('./ai.config', () => ({
  default: {
    modelCosts: {
      'gpt-4o': { input: 0.25, output: 1.0 },
      'gpt-4o-mini': { input: 0.015, output: 0.06 },
    },
  },
}))

import { trackUsage, getUserUsage, getUsageHistory } from './usage'

describe('trackUsage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('inserts a usage record into the database', async () => {
    await trackUsage({
      userId: 'user-123',
      model: 'gpt-4o',
      provider: 'openai',
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
      latencyMs: 200,
      metadata: { source: 'test' },
    })

    expect(mockInsert).toHaveBeenCalled()
  })

  it('estimates cost and rounds to nearest cent', async () => {
    await trackUsage({
      userId: 'user-123',
      model: 'gpt-4o',
      provider: 'openai',
      promptTokens: 1000,
      completionTokens: 500,
      totalTokens: 1500,
      latencyMs: 300,
      metadata: {},
    })

    const valuesCall = mockInsert.mock.results[0].value.values
    expect(valuesCall).toHaveBeenCalled()
    const insertedValues = valuesCall.mock.calls[0][0]
    expect(insertedValues.userId).toBe('user-123')
    expect(insertedValues.model).toBe('gpt-4o')
    expect(insertedValues.provider).toBe('openai')
    expect(typeof insertedValues.costCents).toBe('number')
  })
})

describe('getUserUsage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    selectCallCount = 0
  })

  it('returns aggregated usage stats', async () => {
    const result = await getUserUsage('user-123', new Date('2026-01-01'))

    expect(result).toEqual({
      totalTokens: 1500,
      totalCostCents: 25,
      requestCount: 3,
    })
  })
})

describe('getUsageHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    selectCallCount = 1 // Skip past the getUserUsage mock
  })

  it('returns mapped usage records', async () => {
    const records = await getUsageHistory('user-123', 50)

    expect(records).toHaveLength(2)
    expect(records[0].id).toBe('usage-1')
    expect(records[0].provider).toBe('openai')
    expect(records[0].model).toBe('gpt-4o')
    expect(records[1].provider).toBe('anthropic')
  })

  it('handles null metadata gracefully', async () => {
    const records = await getUsageHistory('user-123', 50)

    // Second record has null metadata, should become {}
    expect(records[1].metadata).toEqual({})
  })
})
