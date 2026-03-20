import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@unblocks/core/errors/handler', () => ({
  toErrorResponse: vi.fn().mockReturnValue({ body: { error: { code: 'TEST', message: 'test' } }, status: 500 }),
}))

import { withErrorHandler, getClientIp, getUserAgent } from './routeHandler'
import { toErrorResponse } from '@unblocks/core/errors/handler'

describe('withErrorHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns handler response on success', async () => {
    const handler = vi.fn().mockResolvedValue(Response.json({ ok: true }, { status: 200 }))
    const wrapped = withErrorHandler(handler)

    const request = new Request('http://localhost/api/test')
    const response = await wrapped(request, { params: Promise.resolve({}) })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual({ ok: true })
    expect(handler).toHaveBeenCalledOnce()
  })

  it('catches errors and returns error response via toErrorResponse', async () => {
    const error = new Error('Something went wrong')
    const handler = vi.fn().mockRejectedValue(error)
    const wrapped = withErrorHandler(handler)

    const request = new Request('http://localhost/api/test')
    const response = await wrapped(request, { params: Promise.resolve({}) })

    expect(toErrorResponse).toHaveBeenCalledWith(error)
    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body).toEqual({ error: { code: 'TEST', message: 'test' } })
  })

  it('re-throws Next.js redirect errors', async () => {
    const redirectError = Object.assign(new Error('redirect'), { digest: 'NEXT_REDIRECT;/dashboard' })
    const handler = vi.fn().mockRejectedValue(redirectError)
    const wrapped = withErrorHandler(handler)

    const request = new Request('http://localhost/api/test')
    await expect(wrapped(request, { params: Promise.resolve({}) })).rejects.toThrow(redirectError)
    expect(toErrorResponse).not.toHaveBeenCalled()
  })

  it('re-throws Next.js notFound errors', async () => {
    const notFoundError = Object.assign(new Error('not found'), { digest: 'NEXT_NOT_FOUND' })
    const handler = vi.fn().mockRejectedValue(notFoundError)
    const wrapped = withErrorHandler(handler)

    const request = new Request('http://localhost/api/test')
    await expect(wrapped(request, { params: Promise.resolve({}) })).rejects.toThrow(notFoundError)
    expect(toErrorResponse).not.toHaveBeenCalled()
  })
})

describe('getClientIp', () => {
  it('returns first IP from x-forwarded-for with multiple IPs', () => {
    const request = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '192.168.1.1, 10.0.0.1, 172.16.0.1' },
    })
    expect(getClientIp(request)).toBe('192.168.1.1')
  })

  it('returns x-real-ip when x-forwarded-for is absent', () => {
    const request = new Request('http://localhost', {
      headers: { 'x-real-ip': '10.0.0.5' },
    })
    expect(getClientIp(request)).toBe('10.0.0.5')
  })

  it('returns undefined when no IP headers are present', () => {
    const request = new Request('http://localhost')
    expect(getClientIp(request)).toBeUndefined()
  })
})

describe('getUserAgent', () => {
  it('returns user-agent header value', () => {
    const request = new Request('http://localhost', {
      headers: { 'user-agent': 'Mozilla/5.0 Test' },
    })
    expect(getUserAgent(request)).toBe('Mozilla/5.0 Test')
  })

  it('returns undefined when user-agent header is absent', () => {
    const request = new Request('http://localhost')
    expect(getUserAgent(request)).toBeUndefined()
  })
})
