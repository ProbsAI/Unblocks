import { describe, it, expect, beforeEach, vi } from 'vitest'
import { checkRateLimit, resetRateLimit } from './rateLimiter'
import { RateLimitError } from '../errors/types'

const config = { windowMs: 60_000, maxAttempts: 3 }

describe('checkRateLimit', () => {
  beforeEach(() => {
    resetRateLimit('test-key')
  })

  it('allows requests under the limit', async () => {
    const result1 = await checkRateLimit('test-key', config)
    expect(result1.remaining).toBe(2)

    const result2 = await checkRateLimit('test-key', config)
    expect(result2.remaining).toBe(1)

    const result3 = await checkRateLimit('test-key', config)
    expect(result3.remaining).toBe(0)
  })

  it('returns resetAt timestamp in the future', async () => {
    const before = Date.now()
    const result = await checkRateLimit('test-key', config)

    expect(result.resetAt).toBeGreaterThanOrEqual(before + config.windowMs)
  })

  it('blocks requests over the limit with RateLimitError', async () => {
    await checkRateLimit('test-key', config)
    await checkRateLimit('test-key', config)
    await checkRateLimit('test-key', config)

    await expect(checkRateLimit('test-key', config)).rejects.toThrow(RateLimitError)
  })

  it('uses separate buckets for different keys', async () => {
    await checkRateLimit('key-a', config)
    await checkRateLimit('key-a', config)
    await checkRateLimit('key-a', config)

    // key-b should still be allowed
    const result = await checkRateLimit('key-b', config)
    expect(result.remaining).toBe(2)

    // Clean up
    resetRateLimit('key-a')
    resetRateLimit('key-b')
  })

  it('resets after window expires', async () => {
    // Use fake timers to simulate time passing
    vi.useFakeTimers()

    try {
      await checkRateLimit('expire-key', config)
      await checkRateLimit('expire-key', config)
      await checkRateLimit('expire-key', config)

      // Should be blocked now
      await expect(checkRateLimit('expire-key', config)).rejects.toThrow(RateLimitError)

      // Advance time past the window
      vi.advanceTimersByTime(config.windowMs + 1)

      // Should be allowed again after window expires
      const result = await checkRateLimit('expire-key', config)
      expect(result.remaining).toBe(2)
    } finally {
      vi.useRealTimers()
      resetRateLimit('expire-key')
    }
  })

  it('resetRateLimit clears the entry', async () => {
    await checkRateLimit('reset-key', config)
    await checkRateLimit('reset-key', config)
    await checkRateLimit('reset-key', config)

    resetRateLimit('reset-key')

    // Should be allowed again
    const result = await checkRateLimit('reset-key', config)
    expect(result.remaining).toBe(2)

    resetRateLimit('reset-key')
  })
})
