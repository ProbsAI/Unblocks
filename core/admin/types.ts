export interface AdminUser {
  id: string
  email: string
  name: string | null
  status: string
  emailVerified: boolean
  loginCount: number
  lastLoginAt: Date | null
  createdAt: Date
  plan: string | null
  subscriptionStatus: string | null
}

export interface AdminMetrics {
  totalUsers: number
  activeUsers30d: number
  totalSubscriptions: number
  paidSubscriptions: number
  mrr: number
  totalTeams: number
}

export interface AdminSubscription {
  id: string
  userId: string
  userEmail: string
  plan: string
  status: string
  interval: string | null
  currentPeriodEnd: Date | null
  cancelAtPeriodEnd: boolean
  createdAt: Date
}
