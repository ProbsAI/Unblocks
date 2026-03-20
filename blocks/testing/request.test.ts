import { describe, it, expect } from 'vitest'
import { buildRequest, buildContext, buildAuthenticatedRequest } from './request'

describe('buildRequest', () => {
  it('creates GET request by default', () => {
    const req = buildRequest('/api/test')

    expect(req.method).toBe('GET')
    expect(req.url).toBe('http://localhost:3000/api/test')
    expect(req.headers.get('content-type')).toBe('application/json')
  })

  it('creates POST with JSON body', async () => {
    const req = buildRequest('/api/test', {
      method: 'POST',
      body: { name: 'Alice' },
    })

    expect(req.method).toBe('POST')
    const json = await req.json()
    expect(json).toEqual({ name: 'Alice' })
  })

  it('adds search params', () => {
    const req = buildRequest('/api/test', {
      searchParams: { page: '2', limit: '10' },
    })

    const url = new URL(req.url)
    expect(url.searchParams.get('page')).toBe('2')
    expect(url.searchParams.get('limit')).toBe('10')
  })

  it('adds custom headers', () => {
    const req = buildRequest('/api/test', {
      headers: { 'x-custom': 'value' },
    })

    expect(req.headers.get('x-custom')).toBe('value')
  })

  it('adds cookies as header', () => {
    const req = buildRequest('/api/test', {
      cookies: { session: 'abc123', theme: 'dark' },
    })

    const cookie = req.headers.get('cookie')
    expect(cookie).toContain('session=abc123')
    expect(cookie).toContain('theme=dark')
  })
})

describe('buildContext', () => {
  it('creates context with params promise', async () => {
    const ctx = buildContext({ id: '42', slug: 'test' })

    const params = await ctx.params
    expect(params).toEqual({ id: '42', slug: 'test' })
  })
})

describe('buildAuthenticatedRequest', () => {
  it('adds session cookie', () => {
    const req = buildAuthenticatedRequest('/api/dashboard', 'my-session-token')

    const cookie = req.headers.get('cookie')
    expect(cookie).toContain('__unblocks_session=my-session-token')
  })
})
