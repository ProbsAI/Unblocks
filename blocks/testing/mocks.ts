/**
 * Testing Block — Service Mocks
 *
 * Mock implementations for external services (Stripe, Resend, Redis)
 * and internal modules (DB, config, hooks).
 *
 * Usage:
 *   const emailMock = createEmailMock()
 *   // ... run code that sends email ...
 *   expect(emailMock.getSentEmails()).toHaveLength(1)
 */

// --- Email Mock ---

interface SentEmail {
  to: string
  subject: string
  html: string
}

export interface EmailMock {
  sendEmail: (to: string, subject: string, html: string) => Promise<{ id: string }>
  getSentEmails: () => SentEmail[]
  clear: () => void
  failNext: (error?: string) => void
}

export function createEmailMock(): EmailMock {
  const sent: SentEmail[] = []
  let shouldFail: string | null = null

  return {
    sendEmail: async (to: string, subject: string, html: string) => {
      if (shouldFail) {
        const err = shouldFail
        shouldFail = null
        throw new Error(err)
      }
      sent.push({ to, subject, html })
      return { id: `mock-email-${sent.length}` }
    },
    getSentEmails: () => [...sent],
    clear: () => {
      sent.length = 0
      shouldFail = null
    },
    failNext: (error = 'Mock email send failure') => {
      shouldFail = error
    },
  }
}

// --- Stripe Mock ---

export interface StripeMock {
  createCheckoutSession: (params: Record<string, unknown>) => Promise<{ id: string; url: string }>
  createPortalSession: (params: Record<string, unknown>) => Promise<{ url: string }>
  getCheckoutSessions: () => Array<Record<string, unknown>>
  clear: () => void
}

export function createStripeMock(): StripeMock {
  const sessions: Array<Record<string, unknown>> = []

  return {
    createCheckoutSession: async (params) => {
      const session = { id: `cs_test_${sessions.length + 1}`, url: 'https://checkout.stripe.com/test', ...params }
      sessions.push(session)
      return { id: session.id as string, url: session.url as string }
    },
    createPortalSession: async () => ({
      url: 'https://billing.stripe.com/test',
    }),
    getCheckoutSessions: () => [...sessions],
    clear: () => { sessions.length = 0 },
  }
}

// --- Hook Spy ---

export interface HookSpy {
  calls: Array<{ name: string; args: unknown }>
  wasCalled: (name: string) => boolean
  getCallsFor: (name: string) => unknown[]
  clear: () => void
}

export function createHookSpy(): HookSpy {
  const calls: Array<{ name: string; args: unknown }> = []

  return {
    calls,
    wasCalled: (name) => calls.some((c) => c.name === name),
    getCallsFor: (name) => calls.filter((c) => c.name === name).map((c) => c.args),
    clear: () => { calls.length = 0 },
  }
}

// --- Config Mock ---

const defaultConfigs: Record<string, Record<string, unknown>> = {
  auth: {
    providers: { email: true, google: false, magicLink: false },
    session: { duration: 7 * 24 * 60 * 60 * 1000 },
    password: { minLength: 8, requireUppercase: false, requireNumber: false },
  },
  billing: {
    plans: [],
    trialDays: 0,
    currency: 'usd',
  },
  email: {
    provider: 'resend',
    from: 'test@test.com',
  },
  app: {
    name: 'TestApp',
    url: 'http://localhost:3000',
  },
  jobs: {
    concurrency: 1,
    defaultMaxRetries: 3,
    retryBackoff: 1000,
    retentionPeriod: 7 * 24 * 60 * 60 * 1000,
    schedules: [],
  },
  uploads: {
    storageProvider: 'local',
    maxFileSize: 10 * 1024 * 1024,
    allowedMimeTypes: [],
    localPath: '/tmp/uploads',
  },
  teams: {
    maxTeamsPerUser: 5,
    maxMembersPerTeam: 50,
    roles: ['owner', 'admin', 'member'],
  },
  notifications: {
    enabled: true,
    categories: ['general', 'billing', 'teams'],
    retentionDays: 30,
  },
}

/** Create a mock loadConfig function with overridable defaults */
export function createConfigMock(
  overrides: Record<string, Record<string, unknown>> = {}
): (key: string) => Record<string, unknown> {
  const configs = { ...defaultConfigs, ...overrides }
  return (key: string) => {
    if (!(key in configs)) {
      throw new Error(`Unknown config key: ${key}`)
    }
    return configs[key]
  }
}
