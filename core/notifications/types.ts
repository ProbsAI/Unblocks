import { z } from 'zod'

export const NotificationsConfigSchema = z.object({
  /** Enable notifications */
  enabled: z.boolean().default(true),

  /** Enable real-time notifications via SSE */
  realtime: z.boolean().default(true),

  /** Max notifications to keep per user (0 = unlimited) */
  maxPerUser: z.number().default(500),

  /** Auto-cleanup notifications older than this (ms, default 90 days) */
  retentionPeriod: z.number().default(90 * 24 * 60 * 60 * 1000),

  /** Default notification channels */
  channels: z.object({
    inApp: z.boolean().default(true),
    email: z.boolean().default(false),
  }).default({}),

  /** Notification categories users can configure */
  categories: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    defaultEnabled: z.boolean().default(true),
  })).default([
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
  ]),
})

export type NotificationsConfig = z.infer<typeof NotificationsConfigSchema>

export type NotificationType = 'info' | 'success' | 'warning' | 'error'

export interface Notification {
  id: string
  userId: string
  category: string
  type: NotificationType
  title: string
  body: string
  actionUrl: string | null
  read: boolean
  readAt: Date | null
  metadata: Record<string, unknown>
  createdAt: Date
}

export interface CreateNotificationInput {
  userId: string
  category: string
  type?: NotificationType
  title: string
  body: string
  actionUrl?: string
  metadata?: Record<string, unknown>
}

export interface NotificationPreference {
  id: string
  userId: string
  category: string
  inApp: boolean
  email: boolean
}

export interface OnNotificationCreatedArgs {
  notification: Notification
}
