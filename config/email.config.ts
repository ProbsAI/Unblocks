import type { EmailConfig } from '@unblocks/core/email/types'

const emailConfig: EmailConfig = {
  provider: 'resend',
  resend: {
    apiKey: process.env.RESEND_API_KEY ?? '',
  },
  from: {
    default: { name: 'MyApp', email: 'hello@myapp.com' },
    transactional: { name: 'MyApp', email: 'no-reply@myapp.com' },
  },
  queue: {
    enabled: false,
    retryAttempts: 3,
    retryDelay: '5m',
  },
  templates: {
    useCustom: false,
  },
}

export default emailConfig
