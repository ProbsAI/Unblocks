import { describe, it, expect } from 'vitest'
import { SECURITY_HEADERS, contentSecurityPolicy } from './headers'

describe('SECURITY_HEADERS', () => {
  it('includes Strict-Transport-Security', () => {
    expect(SECURITY_HEADERS['Strict-Transport-Security']).toContain('max-age=')
    expect(SECURITY_HEADERS['Strict-Transport-Security']).toContain('includeSubDomains')
  })

  it('includes X-Content-Type-Options nosniff', () => {
    expect(SECURITY_HEADERS['X-Content-Type-Options']).toBe('nosniff')
  })

  it('includes X-Frame-Options DENY', () => {
    expect(SECURITY_HEADERS['X-Frame-Options']).toBe('DENY')
  })

  it('disables X-XSS-Protection (modern best practice)', () => {
    expect(SECURITY_HEADERS['X-XSS-Protection']).toBe('0')
  })

  it('includes Referrer-Policy', () => {
    expect(SECURITY_HEADERS['Referrer-Policy']).toBe('strict-origin-when-cross-origin')
  })

  it('restricts Permissions-Policy', () => {
    expect(SECURITY_HEADERS['Permissions-Policy']).toContain('camera=()')
    expect(SECURITY_HEADERS['Permissions-Policy']).toContain('microphone=()')
  })

  it('disables DNS prefetch', () => {
    expect(SECURITY_HEADERS['X-DNS-Prefetch-Control']).toBe('off')
  })

  it('has all expected headers', () => {
    const expectedKeys = [
      'Strict-Transport-Security',
      'X-Content-Type-Options',
      'X-Frame-Options',
      'X-XSS-Protection',
      'Referrer-Policy',
      'Permissions-Policy',
      'X-DNS-Prefetch-Control',
    ]
    for (const key of expectedKeys) {
      expect(SECURITY_HEADERS).toHaveProperty(key)
    }
  })
})

describe('contentSecurityPolicy', () => {
  it('includes the directives that carry the protection', () => {
    const csp = contentSecurityPolicy()

    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("base-uri 'self'")
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("form-action 'self'")
  })

  it("never emits 'unsafe-eval' in production", () => {
    // React Refresh needs it in dev; shipping it would defeat script-src.
    expect(contentSecurityPolicy()).not.toContain("'unsafe-eval'")
    expect(contentSecurityPolicy({ dev: false })).not.toContain("'unsafe-eval'")
  })

  it("emits 'unsafe-eval' only when dev is true", () => {
    expect(contentSecurityPolicy({ dev: true })).toContain("'unsafe-eval'")
  })

  it('allows the Stripe origins the checkout flow needs', () => {
    const csp = contentSecurityPolicy()
    expect(csp).toContain('https://js.stripe.com')
    expect(csp).toContain('https://api.stripe.com')
  })
})
