import type { JobsConfig } from '@unblocks/core/jobs/types'

const config: JobsConfig = {
  enabled: true,
  backend: 'database',
  concurrency: 5,
  defaultMaxRetries: 3,
  defaultRetryBackoff: 1000,
  defaultTimeout: 300_000,
  pollInterval: 1000,
  retentionPeriod: 7 * 24 * 60 * 60 * 1000, // 7 days
  schedules: [
    {
      name: 'cleanup-jobs',
      cron: '0 3 * * *', // 3 AM daily
      jobType: 'system:cleanup-jobs',
      enabled: true,
    },
    {
      name: 'cleanup-sessions',
      cron: '0 4 * * *', // 4 AM daily
      jobType: 'system:cleanup-sessions',
      enabled: true,
    },
  ],
}

export default config
