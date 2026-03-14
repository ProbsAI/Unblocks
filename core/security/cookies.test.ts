import { describe, it, expect, afterEach } from 'vitest'

const env = process.env as Record<string, string | undefined>
import {
  SESSION_COOKIE_NAME,
  CSRF_COOKIE_NAME,
  getSessionCookieOptions,
  getCsrfCookieOptions,
  serializeCookie,
  clearCookie,
} from './cookies'
import type { CookieOptions } from './cookies'

describe('cookie constants', () => {
  it('exports correct session cookie name', () => {
    expect(SESSION_COOKIE_NAME).toBe('__unblocks_session')
  })

  it('exports correct CSRF cookie name', () => {
    expect(CSRF_COOKIE_NAME).toBe('__unblocks_csrf')
  })
})

describe('getSessionCookieOptions', () => {
  const originalEnv = env.NODE_ENV

  afterEach(() => {
    env.NODE_ENV = originalEnv
  })

  it('returns httpOnly true', () => {
    const options = getSessionCookieOptions()
    expect(options.httpOnly).toBe(true)
  })

  it('returns sameSite lax', () => {
    const options = getSessionCookieOptions()
    expect(options.sameSite).toBe('lax')
  })

  it('returns path /', () => {
    const options = getSessionCookieOptions()
    expect(options.path).toBe('/')
  })

  it('returns maxAge of 7 days in seconds', () => {
    const options = getSessionCookieOptions()
    expect(options.maxAge).toBe(7 * 24 * 60 * 60)
  })

  it('returns secure true in production', () => {
    env.NODE_ENV = 'production'
    const options = getSessionCookieOptions()
    expect(options.secure).toBe(true)
  })

  it('returns secure false in development', () => {
    env.NODE_ENV = 'development'
    const options = getSessionCookieOptions()
    expect(options.secure).toBe(false)
  })
})

describe('getCsrfCookieOptions', () => {
  const originalEnv = env.NODE_ENV

  afterEach(() => {
    env.NODE_ENV = originalEnv
  })

  it('returns httpOnly false so JS can read it', () => {
    const options = getCsrfCookieOptions()
    expect(options.httpOnly).toBe(false)
  })

  it('returns maxAge of 24 hours in seconds', () => {
    const options = getCsrfCookieOptions()
    expect(options.maxAge).toBe(24 * 60 * 60)
  })

  it('returns secure true in production', () => {
    env.NODE_ENV = 'production'
    const options = getCsrfCookieOptions()
    expect(options.secure).toBe(true)
  })
})

describe('serializeCookie', () => {
  it('serializes a basic cookie with all options', () => {
    const options: CookieOptions = {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 3600,
    }

    const result = serializeCookie('test', 'value123', options)

    expect(result).toContain('test=value123')
    expect(result).toContain('Path=/')
    expect(result).toContain('Max-Age=3600')
    expect(result).toContain('SameSite=Lax')
    expect(result).toContain('HttpOnly')
    expect(result).toContain('Secure')
  })

  it('omits HttpOnly when httpOnly is false', () => {
    const options: CookieOptions = {
      httpOnly: false,
      secure: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 3600,
    }

    const result = serializeCookie('csrf', 'token', options)

    expect(result).not.toContain('HttpOnly')
  })

  it('omits Secure when secure is false', () => {
    const options: CookieOptions = {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 3600,
    }

    const result = serializeCookie('session', 'abc', options)

    expect(result).not.toContain('Secure')
  })

  it('capitalizes SameSite correctly for strict', () => {
    const options: CookieOptions = {
      httpOnly: false,
      secure: false,
      sameSite: 'strict',
      path: '/',
      maxAge: 3600,
    }

    const result = serializeCookie('test', 'val', options)
    expect(result).toContain('SameSite=Strict')
  })

  it('capitalizes SameSite correctly for none', () => {
    const options: CookieOptions = {
      httpOnly: false,
      secure: true,
      sameSite: 'none',
      path: '/',
      maxAge: 3600,
    }

    const result = serializeCookie('test', 'val', options)
    expect(result).toContain('SameSite=None')
  })

  it('encodes special characters in cookie value', () => {
    const options: CookieOptions = {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 3600,
    }

    const result = serializeCookie('test', 'value with spaces & specials=yes', options)
    expect(result).toContain('test=value%20with%20spaces%20%26%20specials%3Dyes')
  })
})

describe('clearCookie', () => {
  it('returns cookie string with Max-Age=0', () => {
    const result = clearCookie('__unblocks_session')
    expect(result).toBe('__unblocks_session=; Path=/; Max-Age=0')
  })

  it('clears any cookie by name', () => {
    const result = clearCookie('my_cookie')
    expect(result).toContain('my_cookie=')
    expect(result).toContain('Max-Age=0')
    expect(result).toContain('Path=/')
  })
})
