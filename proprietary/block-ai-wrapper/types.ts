import { z } from 'zod'

// --- Provider Types ---

export type AIProvider = 'openai' | 'anthropic' | 'google' | 'custom'

// --- Model ---

export interface AIModel {
  id: string
  provider: AIProvider
  name: string
  contextWindow: number
  maxOutput: number
  inputCostPer1k: number
  outputCostPer1k: number
}

// --- Message ---

export type MessageRole = 'system' | 'user' | 'assistant'

export interface Message {
  role: MessageRole
  content: string
}

// --- Completion Request ---

export interface CompletionRequest {
  model: string
  messages: Message[]
  temperature?: number
  maxTokens?: number
  topP?: number
  stream?: boolean
  userId?: string
  metadata?: Record<string, unknown>
}

// --- Completion Response ---

export interface CompletionResponse {
  id: string
  model: string
  content: string
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  finishReason: string
  latencyMs: number
}

// --- Prompt Template ---

export interface PromptTemplate {
  id: string
  name: string
  description: string
  template: string
  variables: string[]
  model: string
  temperature?: number
  maxTokens?: number
  createdAt: Date
  updatedAt: Date
}

// --- Usage Record ---

export interface UsageRecord {
  id: string
  userId: string
  model: string
  provider: AIProvider
  promptTokens: number
  completionTokens: number
  totalTokens: number
  costCents: number
  latencyMs: number
  metadata: Record<string, unknown>
  createdAt: Date
}

// --- Config ---

export const AIWrapperConfigSchema = z.object({
  /** Enable the AI wrapper block */
  enabled: z.boolean().default(false),

  /** Default provider */
  defaultProvider: z.enum(['openai', 'anthropic', 'google', 'custom']).default('openai'),

  /** Default model */
  defaultModel: z.string().default('gpt-4o'),

  /** Provider API keys (loaded from env) */
  providers: z.object({
    openai: z.object({
      apiKey: z.string().default(''),
      baseUrl: z.string().default('https://api.openai.com/v1'),
    }).default({}),
    anthropic: z.object({
      apiKey: z.string().default(''),
      baseUrl: z.string().default('https://api.anthropic.com'),
    }).default({}),
    google: z.object({
      apiKey: z.string().default(''),
    }).default({}),
  }).default({}),

  /** Usage limits per user per day (0 = unlimited) */
  dailyTokenLimit: z.number().default(0),

  /** Usage limits per user per month (0 = unlimited) */
  monthlyTokenLimit: z.number().default(0),

  /** Max tokens per request */
  maxTokensPerRequest: z.number().default(4096),

  /** Default temperature */
  defaultTemperature: z.number().min(0).max(2).default(0.7),

  /** Enable usage tracking */
  trackUsage: z.boolean().default(true),

  /** Enable prompt caching */
  cacheEnabled: z.boolean().default(false),

  /** Cache TTL in ms (default 1 hour) */
  cacheTtl: z.number().default(3600_000),

  /** Cost per 1K tokens by model (cents). Override to keep pricing current. */
  modelCosts: z.record(z.object({
    input: z.number(),
    output: z.number(),
  })).default({
    'gpt-4o': { input: 0.25, output: 1.0 },
    'gpt-4o-mini': { input: 0.015, output: 0.06 },
    'gpt-4-turbo': { input: 1.0, output: 3.0 },
    'claude-sonnet-4-6': { input: 0.3, output: 1.5 },
    'claude-haiku-4-5-20251001': { input: 0.08, output: 0.4 },
    'claude-opus-4-6': { input: 1.5, output: 7.5 },
    'gemini-2.0-flash': { input: 0.015, output: 0.06 },
  }),
})

export type AIWrapperConfig = z.infer<typeof AIWrapperConfigSchema>
