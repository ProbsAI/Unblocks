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

  // Compare BYTE lengths, not JavaScript string lengths. timingSafeEqual works
  // on buffers and throws when they differ in size, so two strings of equal
  // .length but different UTF-8 widths (any non-ASCII character) got past the
  // guard and threw — turning a malformed OAuth callback into a 500 rather than
  // the documented false.
  const cookieBytes = Buffer.from(cookieToken, 'utf8')
  const headerBytes = Buffer.from(headerToken, 'utf8')
  if (cookieBytes.length !== headerBytes.length) return false

  return timingSafeEqual(cookieBytes, headerBytes)
}
