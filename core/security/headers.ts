export const SECURITY_HEADERS: Record<string, string> = {
  // Browsers ignore HSTS over plain HTTP, so this is safe to send in local dev.
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '0',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'X-DNS-Prefetch-Control': 'off',
}

/**
 * Content-Security-Policy for the app shell.
 *
 * Honest caveat: script-src carries 'unsafe-inline' because Next.js emits inline
 * bootstrap and hydration scripts. Removing it requires per-request nonces
 * threaded from middleware into the document, which is a larger change. As
 * written this still blocks external script origins, framing, form hijacking
 * and base-tag injection — it is a meaningful floor, not a strict CSP.
 *
 * `dev` additionally allows 'unsafe-eval', which the Next dev server needs for
 * React Refresh and which must never be enabled in production.
 */
export function contentSecurityPolicy(options: { dev?: boolean } = {}): string {
  const scriptSrc = [
    "'self'",
    "'unsafe-inline'",
    'https://js.stripe.com',
    ...(options.dev ? ["'unsafe-eval'"] : []),
  ]

  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'base-uri': ["'self'"],
    'object-src': ["'none'"],
    'frame-ancestors': ["'none'"],
    'form-action': ["'self'"],
    'img-src': ["'self'", 'data:', 'https:'],
    'font-src': ["'self'", 'data:'],
    'style-src': ["'self'", "'unsafe-inline'"],
    'script-src': scriptSrc,
    'connect-src': ["'self'", 'https://api.stripe.com'],
    'frame-src': ['https://js.stripe.com', 'https://hooks.stripe.com'],
  }

  return Object.entries(directives)
    .map(([directive, values]) => `${directive} ${values.join(' ')}`)
    .join('; ')
}
