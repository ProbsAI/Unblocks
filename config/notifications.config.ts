import type { NotificationsConfig } from '@unblocks/core/notifications/types'

const config: NotificationsConfig = {
  enabled: true,
  realtime: true,
  maxPerUser: 500,
  retentionPeriod: 90 * 24 * 60 * 60 * 1000, // 90 days
  channels: {
    inApp: true,
    email: false,
  },
  categories: [
    {
      id: 'billing',
      name: 'Billing',
      description: 'Payment confirmations, subscription changes',
      defaultEnabled: true,
    },
    {
      id: 'team',
      name: 'Team',
      description: 'Team invitations, member changes',
      defaultEnabled: true,
    },
    {
      id: 'security',
      name: 'Security',
      description: 'Login alerts, password changes',
      defaultEnabled: true,
    },
    {
      id: 'system',
      name: 'System',
      description: 'System updates and announcements',
      defaultEnabled: true,
    },
  ],
}

export default config
