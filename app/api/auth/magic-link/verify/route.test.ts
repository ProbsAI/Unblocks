import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * The magic-link login-CSRF fix.
 *
 * The defect: verifying a magic link was a public GET that called createSession
 * and set the session cookie. An attacker requests a link for their OWN
 * account, sends the victim that URL, and the victim's browser silently signs
 * them into the attacker's account — where everything they do next is visible
 * to the attacker. The same-origin check in middleware.ts cannot help, because
 * it keys off the HTTP method and treats GET as safe.
 *
 * What these tests hold in place:
 *
 *   - GET never creates a session when confirmation is required. That is the
 *     entire fix; if a future change adds a "fast path" back to GET, the hole
 *     reopens with nothing else failing.
 *   - The session is created by POST, which the existing CSRF gate covers.
 *   - An account switch needs explicit consent, and is refused BEFORE the token
 *     is consumed, so declining does not strand the legitimate recipient.
 */

const { state } = vi.hoisted(() => ({
  state: {
    requireConfirmation: true,
    currentUser: null as { id: string; email: string } | null,
    sessionCookie: undefined as string | undefined,
    peeked: { email: 'target@example.com' } as { email: string } | null,
    verifyThrows: false,
  },
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) =>
      name === 'session' && state.sessionCookie
        ? { value: state.sessionCookie }
        : undefined,
  })),
}))

vi.mock('@/lib/serverAuth', () => ({
  getCurrentUser: vi.fn(async () => state.currentUser),
}))

vi.mock('@unblocks/core/auth', () => ({
  peekMagicLink: vi.fn(async () => state.peeked),
  verifyMagicLink: vi.fn(async () => {
    if (state.verifyThrows) throw new Error('Invalid or expired magic link')
    return { id: 'target-user', email: 'target@example.com' }
  }),
  createSession: vi.fn(async () => ({ token: 'new-session-token' })),
  revokeSessionByToken: vi.fn(async () => undefined),
}))

vi.mock('@unblocks/core/security/cookies', () => ({
  SESSION_COOKIE_NAME: 'session',
  getSessionCookieOptions: vi.fn(() => ({})),
  serializeCookie: vi.fn((name: string, value: string) => `${name}=${value}`),
}))

vi.mock('@unblocks/core/runtime/configLoader', () => ({
  loadConfig: vi.fn(() => ({
    providers: { magicLink: { requireConfirmation: state.requireConfirmation } },
    redirects: { afterLogin: '/dashboard' },
  })),
}))

import {
  peekMagicLink,
  verifyMagicLink,
  createSession,
  revokeSessionByToken,
} from '@unblocks/core/auth'
import { GET, POST } from './route'

const CONTEXT = {
  params: Promise.resolve({} as Record<string, string | string[]>),
}
const TOKEN = 'a'.repeat(64)

beforeEach(() => {
  vi.clearAllMocks()
  state.requireConfirmation = true
  state.currentUser = null
  state.sessionCookie = undefined
  state.peeked = { email: 'target@example.com' }
  state.verifyThrows = false
})

function getRequest(token?: string): Request {
  const url = token
    ? `https://app.example.com/api/auth/magic-link/verify?token=${token}`
    : 'https://app.example.com/api/auth/magic-link/verify'
  return new Request(url)
}

function formRequest(fields: Record<string, string>): Request {
  return new Request('https://app.example.com/api/auth/magic-link/verify', {
    method: 'POST',
    body: new URLSearchParams(fields),
  })
}

describe('GET — the emailed link', () => {
  it('never creates a session when confirmation is required', async () => {
    const response = await GET(getRequest(TOKEN), CONTEXT)

    // This single assertion is the fix. A GET that reaches createSession is
    // exploitable no matter what else the handler does.
    expect(createSession).not.toHaveBeenCalled()
    expect(verifyMagicLink).not.toHaveBeenCalled()
    expect(response.status).toBe(302)
    expect(response.headers.get('Location')).toBe(
      `/magic-link/confirm?token=${TOKEN}`
    )
    expect(response.headers.get('Set-Cookie')).toBeNull()
  })

  it('does not even look the token up before handing off to the page', async () => {
    await GET(getRequest(TOKEN), CONTEXT)

    expect(peekMagicLink).not.toHaveBeenCalled()
  })

  it('percent-encodes the token it passes on', async () => {
    const response = await GET(getRequest('a%2Fb'), CONTEXT)

    // Round-trips through the URL parser, so the page receives the same token
    // the email carried rather than a decoded variant.
    expect(response.headers.get('Location')).toBe(
      '/magic-link/confirm?token=a%2Fb'
    )
  })

  it('redirects to login when no token is present', async () => {
    const response = await GET(getRequest(), CONTEXT)

    expect(response.headers.get('Location')).toBe('/login?error=invalid_token')
    expect(createSession).not.toHaveBeenCalled()
  })

  describe('with requireConfirmation turned off', () => {
    beforeEach(() => {
      state.requireConfirmation = false
    })

    it('signs in directly when nobody is signed in', async () => {
      const response = await GET(getRequest(TOKEN), CONTEXT)

      expect(verifyMagicLink).toHaveBeenCalledWith(TOKEN)
      expect(createSession).toHaveBeenCalled()
      expect(response.headers.get('Location')).toBe(
        '/dashboard?signed_in_via=magic_link'
      )
      expect(response.headers.get('Set-Cookie')).toBe(
        'session=new-session-token'
      )
    })

    it('still refuses to change accounts from a GET', async () => {
      // The opt-out covers one-click sign-in, not silently swapping which
      // account someone is operating as — the damaging half of the attack.
      state.currentUser = { id: 'victim', email: 'victim@example.com' }

      const response = await GET(getRequest(TOKEN), CONTEXT)

      expect(createSession).not.toHaveBeenCalled()
      expect(response.headers.get('Location')).toBe(
        `/magic-link/confirm?token=${TOKEN}`
      )
    })

    it('reports an unusable link as invalid rather than throwing', async () => {
      state.verifyThrows = true

      const response = await GET(getRequest(TOKEN), CONTEXT)

      expect(response.headers.get('Location')).toBe('/login?error=invalid_token')
    })
  })
})

describe('POST — the interstitial form', () => {
  it('creates the session and marks how it was created', async () => {
    const response = await POST(
      formRequest({ token: TOKEN, confirm: '1' }),
      CONTEXT
    )

    expect(verifyMagicLink).toHaveBeenCalledWith(TOKEN)
    // 303, not 302: the browser must follow with a GET, so reloading the
    // landing page cannot re-submit the form against an already-used token.
    expect(response.status).toBe(303)
    expect(response.headers.get('Location')).toBe(
      '/dashboard?signed_in_via=magic_link'
    )
    expect(response.headers.get('Set-Cookie')).toBe('session=new-session-token')
  })

  it('refuses a post that did not come through the interstitial', async () => {
    const response = await POST(formRequest({ token: TOKEN }), CONTEXT)

    expect(verifyMagicLink).not.toHaveBeenCalled()
    expect(response.headers.get('Location')).toBe(
      `/magic-link/confirm?token=${TOKEN}`
    )
  })

  it('accepts a JSON body for non-browser callers', async () => {
    const response = await POST(
      new Request('https://app.example.com/api/auth/magic-link/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: TOKEN, confirm: '1' }),
      }),
      CONTEXT
    )

    expect(createSession).toHaveBeenCalled()
    expect(response.headers.get('Location')).toBe(
      '/dashboard?signed_in_via=magic_link'
    )
  })

  it('treats a token the database rejects as invalid', async () => {
    state.peeked = null

    const response = await POST(
      formRequest({ token: TOKEN, confirm: '1' }),
      CONTEXT
    )

    expect(verifyMagicLink).not.toHaveBeenCalled()
    expect(response.headers.get('Location')).toBe('/login?error=invalid_token')
  })
})

describe('POST — switching accounts', () => {
  beforeEach(() => {
    state.currentUser = { id: 'victim', email: 'victim@example.com' }
    state.sessionCookie = 'existing-session-token'
  })

  it('refuses without explicit consent, and does not burn the link', async () => {
    const response = await POST(
      formRequest({ token: TOKEN, confirm: '1' }),
      CONTEXT
    )

    // Ordering is the point: verifyMagicLink marks the token used. Refusing
    // after calling it would leave the legitimate recipient with a dead link.
    expect(verifyMagicLink).not.toHaveBeenCalled()
    expect(createSession).not.toHaveBeenCalled()
    expect(response.headers.get('Location')).toBe(
      `/magic-link/confirm?token=${TOKEN}`
    )
  })

  it('proceeds when the switch is confirmed, and drops the old session', async () => {
    const response = await POST(
      formRequest({ token: TOKEN, confirm: '1', switch_account: '1' }),
      CONTEXT
    )

    expect(verifyMagicLink).toHaveBeenCalledWith(TOKEN)
    // Replacing the cookie is not enough: the old token stays valid server-side
    // otherwise, so a copy of it would still authenticate as the old account.
    expect(revokeSessionByToken).toHaveBeenCalledWith('existing-session-token')
    expect(response.headers.get('Set-Cookie')).toBe('session=new-session-token')
  })

  it('does not treat re-signing into the same account as a switch', async () => {
    state.currentUser = { id: 'target-user', email: 'target@example.com' }

    await POST(formRequest({ token: TOKEN, confirm: '1' }), CONTEXT)

    expect(verifyMagicLink).toHaveBeenCalledWith(TOKEN)
    expect(revokeSessionByToken).not.toHaveBeenCalled()
  })
})
