import type { NextConfig } from 'next'
import { SECURITY_HEADERS, contentSecurityPolicy } from './core/security/headers'

// Single source of truth: these were previously duplicated here by hand, which
// is how HSTS went missing from the headers actually served.
const securityHeaders = [
  ...Object.entries(SECURITY_HEADERS).map(([key, value]) => ({ key, value })),
  {
    key: 'Content-Security-Policy',
    value: contentSecurityPolicy({ dev: process.env.NODE_ENV !== 'production' }),
  },
]

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig
