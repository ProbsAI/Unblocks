import { RateLimitError } from '../errors/types'

interface RateLimitEntry {
  count: number
  resetAt: number
}

// In-memory store (replaced by Redis in production)
const store = new Map<string, RateLimitEntry>()

export interface RateLimitConfig {
  windowMs: number
  maxAttempts: number
}

export async function checkRateLimit(
  key: string,
  config: RateLimitConfig
): Promise<{ remaining: number; resetAt: number }> {
  const now = Date.now()
  const entry = store.get(key)

  // Clean expired entries
  if (entry && entry.resetAt <= now) {
    store.delete(key)
  }

  const current = store.get(key)

  if (!current) {
    store.set(key, { count: 1, resetAt: now + config.windowMs })
    return { remaining: config.maxAttempts - 1, resetAt: now + config.windowMs }
  }

  if (current.count >= config.maxAttempts) {
    const retryAfter = Math.ceil((current.resetAt - now) / 1000)
    throw new RateLimitError(retryAfter)
  }

  current.count++
  return { remaining: config.maxAttempts - current.count, resetAt: current.resetAt }
}

export function resetRateLimit(key: string): void {
  store.delete(key)
}

// Periodic cleanup of expired entries
const cleanupInterval = setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt <= now) {
      store.delete(key)
    }
  }
}, 60_000)
cleanupInterval.unref?.()
