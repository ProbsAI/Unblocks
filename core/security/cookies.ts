export const SESSION_COOKIE_NAME = '__unblocks_session'
export const CSRF_COOKIE_NAME = '__unblocks_csrf'

export interface CookieOptions {
  httpOnly: boolean
  secure: boolean
  sameSite: 'lax' | 'strict' | 'none'
  path: string
  maxAge: number
}

export function getSessionCookieOptions(): CookieOptions {
  const isProduction = process.env.NODE_ENV === 'production'

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
  }
}

export function getCsrfCookieOptions(): CookieOptions {
  const isProduction = process.env.NODE_ENV === 'production'

  return {
    httpOnly: false, // JS needs to read this
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: 24 * 60 * 60, // 24 hours in seconds
  }
}

export function serializeCookie(
  name: string,
  value: string,
  options: CookieOptions
): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${options.path}`,
    `Max-Age=${options.maxAge}`,
    `SameSite=${options.sameSite.charAt(0).toUpperCase() + options.sameSite.slice(1)}`,
  ]

  if (options.httpOnly) parts.push('HttpOnly')
  if (options.secure) parts.push('Secure')

  return parts.join('; ')
}

export function clearCookie(name: string): string {
  return `${name}=; Path=/; Max-Age=0`
}
