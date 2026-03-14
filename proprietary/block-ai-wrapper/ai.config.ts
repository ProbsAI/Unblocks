import type { AIWrapperConfig } from './types'

const config: AIWrapperConfig = {
  enabled: true,
  defaultProvider: 'openai',
  defaultModel: 'gpt-4o',
  providers: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY ?? '',
      baseUrl: 'https://api.openai.com/v1',
    },
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY ?? '',
      baseUrl: 'https://api.anthropic.com',
    },
    google: {
      apiKey: process.env.GOOGLE_AI_API_KEY ?? '',
    },
  },
  dailyTokenLimit: 0,
  monthlyTokenLimit: 0,
  maxTokensPerRequest: 4096,
  defaultTemperature: 0.7,
  trackUsage: true,
  cacheEnabled: false,
  cacheTtl: 3_600_000,
}

export default config
