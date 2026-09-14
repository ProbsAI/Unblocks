import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { middleware } from './middleware'

/**
 * Tests for the two middleware security properties:
 *
 *  1. x-api-key is an internal header. serverAuth treats its presence as proof
 *     that middleware validated a Bearer token, so a client-supplied copy must
 *     never survive — including on public paths, which reach getCurrentUser()
 *     too.
 *  2. State-changing requests carrying an ambient credential must be
 *     same-origin. This replaces a CSRF module that existed but was never
 *     called from anywhere in the app.
 */

vi.mock('jose', () => ({
  jwtVerify: vi.fn().mockResolvedValue({ payload: { sub: 'user-1' } }),
}))

const APP_ORIGIN = 'https://app.example.com'

beforeEach(() => {
  process.env.APP_URL = APP_ORIGIN
  process.env.SESSION_SECRET = 'test-secret'
})

function req(
  path: string,
  init: {
    method?: string
    headers?: Record<string, string>
    cookie?: string
  } = {}
): NextRequest {
  const headers = new Headers(init.headers ?? {})
  if (init.cookie) headers.set('cookie', init.cookie)
  return new NextRequest(`${APP_ORIGIN}${path}`, {
    method: init.method ?? 'GET',
    headers,
  })
}

/** The headers the route handler will actually observe. */
function forwardedHeaders(response: Response): Headers | undefined {
  const overridden = response.headers.get('x-middleware-override-headers')
  if (!overridden) return undefined
  const result = new Headers()
  for (const name of overridden.split(',').map((n) => n.trim())) {
    const value = response.headers.get(`x-middleware-request-${name}`)
    if (value !== null) result.set(name, value)
  }
  return result
}

describe('x-api-key trust boundary', () => {
  it('strips a client-supplied x-api-key on a public path', async () => {
    const response = await middleware(
      req('/api/auth/session', { headers: { 'x-api-key': 'ub_live_forged' } })
    )

    const forwarded = forwardedHeaders(response)
    expect(forwarded?.get('x-api-key')).toBeNull()
  })

  it('strips a client-supplied x-api-key when a Bearer key is absent', async () => {
    const response = await middleware(
      req('/api/teams', {
        headers: { 'x-api-key': 'ub_live_forged' },
        cookie: '__unblocks_session=valid.jwt.token',
      })
    )

    const forwarded = forwardedHeaders(response)
    expect(forwarded?.get('x-api-key')).toBeNull()
  })

  it('replaces a forged value with the real Bearer token rather than trusting it', async () => {
    const response = await middleware(
      req('/api/teams', {
        headers: {
          'x-api-key': 'ub_live_forged',
          authorization: 'Bearer ub_live_genuine',
        },
      })
    )

    const forwarded = forwardedHeaders(response)
    expect(forwarded?.get('x-api-key')).toBe('ub_live_genuine')
  })

  it('forwards a validated Bearer API key to the route handler', async () => {
    const response = await middleware(
      req('/api/teams', {
        headers: { authorization: 'Bearer ub_live_abc123' },
      })
    )

    const forwarded = forwardedHeaders(response)
    expect(forwarded?.get('x-api-key')).toBe('ub_live_abc123')
  })
})

describe('CSRF same-origin enforcement', () => {
  it('rejects a cross-origin POST carrying a session cookie', async () => {
    const response = await middleware(
      req('/api/teams', {
        method: 'POST',
        headers: { origin: 'https://evil.example.com' },
        cookie: '__unblocks_session=valid.jwt.token',
      })
    )

    expect(response.status).toBe(403)
  })

  it('rejects a cross-origin POST to an unauthenticated auth endpoint', async () => {
    const response = await middleware(
      req('/api/auth/login', {
        method: 'POST',
        headers: { origin: 'https://evil.example.com' },
      })
    )

    expect(response.status).toBe(403)
  })

  it('allows a same-origin POST', async () => {
    const response = await middleware(
      req('/api/auth/login', {
        method: 'POST',
        headers: { origin: APP_ORIGIN },
      })
    )

    expect(response.status).not.toBe(403)
  })

  it('allows GET regardless of origin', async () => {
    const response = await middleware(
      req('/api/auth/session', {
        headers: { origin: 'https://evil.example.com' },
      })
    )

    expect(response.status).not.toBe(403)
  })

  it('does not block a Bearer API key request that has no Origin', async () => {
    // Server-to-server calls send no Origin. A Bearer token is not ambient, so
    // blocking these would break the API key feature without adding safety.
    const response = await middleware(
      req('/api/teams', {
        method: 'POST',
        headers: { authorization: 'Bearer ub_live_abc123' },
      })
    )

    expect(response.status).not.toBe(403)
  })

  it('blocks an originless POST that carries a session cookie', async () => {
    const response = await middleware(
      req('/api/teams', {
        method: 'POST',
        cookie: '__unblocks_session=valid.jwt.token',
      })
    )

    expect(response.status).toBe(403)
  })

  it('exempts the Stripe webhook, which is signature-authenticated', async () => {
    const response = await middleware(
      req('/api/billing/webhook', { method: 'POST' })
    )

    expect(response.status).not.toBe(403)
  })
})
