import { randomBytes, timingSafeEqual } from 'crypto'

export function generateCsrfToken(): string {
  return randomBytes(32).toString('hex')
}

export function validateCsrfToken(
  cookieToken: string | undefined,
  headerToken: string | undefined
): boolean {
  if (!cookieToken || !headerToken) return false
  if (cookieToken.length !== headerToken.length) return false
  return timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken))
}
