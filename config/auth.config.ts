import type { AuthConfig } from '@unblocks/core/auth/types'

const authConfig: AuthConfig = {
  providers: {
    email: { enabled: true },
    google: { enabled: false, clientId: '', clientSecret: '' },
    magicLink: { enabled: false },
  },
  session: {
    strategy: 'jwt',
    duration: '7d',
    refreshWindow: '1d',
    maxConcurrentSessions: 5,
  },
  password: {
    minLength: 8,
    requireUppercase: false,
    requireNumber: false,
    requireSpecial: false,
  },
  security: {
    maxLoginAttempts: 5,
    lockoutDuration: '15m',
    requireEmailVerification: true,
    allowSignup: true,
    allowPasswordReset: true,
    csrfProtection: true,
  },
  redirects: {
    afterLogin: '/dashboard',
    afterLogout: '/',
    afterSignup: '/dashboard',
    afterEmailVerification: '/dashboard',
  },
  roles: {
    default: 'member',
    available: ['owner', 'admin', 'member', 'viewer'],
  },
}

export default authConfig
