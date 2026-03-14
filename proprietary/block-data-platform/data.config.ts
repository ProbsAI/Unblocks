import type { DataPlatformConfig } from './types'

const config: DataPlatformConfig = {
  enabled: true,
  maxDatasetsPerUser: 50,
  maxPipelinesPerUser: 20,
  maxDataSourceSize: 100 * 1024 * 1024,
  scheduledPipelines: true,
  maxExecutionTime: 300_000,
  scraping: {
    enabled: false,
    maxPagesPerRun: 100,
    respectRobotsTxt: true,
    rateLimitMs: 1000,
  },
}

export default config
