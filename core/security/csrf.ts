import { randomBytes, timingSafeEqual } from 'crypto'

/**
 * Generate a high-entropy, single-use token.
 *
 * Used for the OAuth `state` parameter, which is a double-submit check: the
 * value is stored in a cookie and echoed back in the redirect, and the two must
 * match for the callback to be accepted.
 *
 * Note: blanket CSRF protection for state-changing requests is enforced by the
 * same-origin check in `middleware.ts`, not here. That check needs no
 * cooperation from client code, so it cannot be silently bypassed by a form
 * that forgets to attach a token.
 */
export function generateCsrfToken(): string {
  return randomBytes(32).toString('hex')
}

/**
 * Constant-time comparison of a token held in a cookie against one supplied by
 * the request. Returns false rather than throwing on absent or mismatched-length
 * input.
 */
export function validateCsrfToken(
  cookieToken: string | undefined,
  headerToken: string | undefined
): boolean {
  if (!cookieToken || !headerToken) return false
  if (cookieToken.length !== headerToken.length) return false
  return timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken))
}
