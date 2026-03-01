import { SESSION_COOKIE_NAME } from '@unblocks/core/security/cookies'

/**
 * Testing Block — HTTP Request Helpers
 *
 * Helpers for building Request objects to test API route handlers.
 *
 * Usage:
 *   const req = buildRequest('/api/auth/login', {
 *     method: 'POST',
 *     body: { email: 'test@test.com', password: 'password' },
 *   })
 *   const response = await POST(req, buildContext())
 */

interface RequestOptions {
  method?: string
  body?: unknown
  headers?: Record<string, string>
  cookies?: Record<string, string>
  searchParams?: Record<string, string>
}

/** Build a Request object for testing route handlers */
export function buildRequest(
  path: string,
  options: RequestOptions = {}
): Request {
  const {
    method = 'GET',
    body,
    headers = {},
    cookies = {},
    searchParams = {},
  } = options

  const url = new URL(path, 'http://localhost:3000')
  for (const [key, value] of Object.entries(searchParams)) {
    url.searchParams.set(key, value)
  }

  const allHeaders: Record<string, string> = {
    'content-type': 'application/json',
    ...headers,
  }

  // Build cookie header
  const cookieEntries = Object.entries(cookies)
  if (cookieEntries.length > 0) {
    allHeaders['cookie'] = cookieEntries
      .map(([k, v]) => `${k}=${v}`)
      .join('; ')
  }

  const init: RequestInit = {
    method,
    headers: allHeaders,
  }

  if (body && method !== 'GET' && method !== 'HEAD') {
    init.body = JSON.stringify(body)
  }

  return new Request(url.toString(), init)
}

/** Build the context object (with params) for route handlers */
export function buildContext(
  params: Record<string, string> = {}
): { params: Promise<Record<string, string>> } {
  return { params: Promise.resolve(params) }
}

/** Build a Request with an auth session cookie */
export function buildAuthenticatedRequest(
  path: string,
  sessionToken: string,
  options: RequestOptions = {}
): Request {
  return buildRequest(path, {
    ...options,
    cookies: {
      [SESSION_COOKIE_NAME]: sessionToken,
      ...options.cookies,
    },
  })
}
