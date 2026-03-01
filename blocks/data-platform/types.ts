import { z } from 'zod'

// --- Pipeline Types ---

export type PipelineStatus = 'draft' | 'active' | 'paused' | 'error'
export type PipelineStepType = 'fetch' | 'transform' | 'filter' | 'output'
export type PipelineRunStatus = 'pending' | 'running' | 'completed' | 'failed'

export interface PipelineStep {
  id: string
  type: PipelineStepType
  name: string
  config: Record<string, unknown>
  order: number
}

export interface Pipeline {
  id: string
  userId: string
  teamId: string | null
  name: string
  description: string
  steps: PipelineStep[]
  schedule: string | null
  status: PipelineStatus
  lastRunAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface PipelineRun {
  id: string
  pipelineId: string
  status: PipelineRunStatus
  rowsProcessed: number
  error: string | null
  startedAt: Date
  completedAt: Date | null
  durationMs: number | null
}

// --- Data Source Types ---

export type DataSourceType = 'url' | 'api' | 'csv' | 'database' | 'webhook'

export interface DataSource {
  id: string
  userId: string
  name: string
  type: DataSourceType
  config: Record<string, unknown>
  lastSyncAt: Date | null
  createdAt: Date
  updatedAt: Date
}

// --- Dataset ---

export interface Dataset {
  id: string
  userId: string
  teamId: string | null
  name: string
  description: string
  sourceId: string | null
  pipelineId: string | null
  rowCount: number
  sizeBytes: number
  schema: Record<string, string>
  createdAt: Date
  updatedAt: Date
}

// --- Config ---

export const DataPlatformConfigSchema = z.object({
  /** Enable the data platform block */
  enabled: z.boolean().default(false),

  /** Max datasets per user (0 = unlimited) */
  maxDatasetsPerUser: z.number().default(50),

  /** Max pipelines per user (0 = unlimited) */
  maxPipelinesPerUser: z.number().default(20),

  /** Max data source size in bytes (default 100MB) */
  maxDataSourceSize: z.number().default(100 * 1024 * 1024),

  /** Enable scheduled pipelines */
  scheduledPipelines: z.boolean().default(true),

  /** Max pipeline execution time in ms (default 5 minutes) */
  maxExecutionTime: z.number().default(300_000),

  /** Enable web scraping */
  scraping: z.object({
    enabled: z.boolean().default(false),
    maxPagesPerRun: z.number().default(100),
    respectRobotsTxt: z.boolean().default(true),
    rateLimitMs: z.number().default(1000),
  }).default({}),
})

export type DataPlatformConfig = z.infer<typeof DataPlatformConfigSchema>
