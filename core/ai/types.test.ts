import { describe, it, expect } from 'vitest'
import { AIWrapperConfigSchema } from './types'

describe('AIWrapperConfigSchema', () => {
  it('provides sensible defaults when parsing empty object', () => {
    const config = AIWrapperConfigSchema.parse({})

    expect(config.enabled).toBe(false)
    expect(config.defaultProvider).toBe('openai')
    expect(config.defaultModel).toBe('gpt-4o')
    expect(config.dailyTokenLimit).toBe(0)
    expect(config.monthlyTokenLimit).toBe(0)
    expect(config.maxTokensPerRequest).toBe(4096)
    expect(config.defaultTemperature).toBe(0.7)
    expect(config.trackUsage).toBe(true)
    expect(config.cacheEnabled).toBe(false)
    expect(config.cacheTtl).toBe(3600_000)
  })

  it('provides default provider configs', () => {
    const config = AIWrapperConfigSchema.parse({})

    expect(config.providers.openai.apiKey).toBe('')
    expect(config.providers.openai.baseUrl).toBe('https://api.openai.com/v1')
    expect(config.providers.anthropic.apiKey).toBe('')
    expect(config.providers.anthropic.baseUrl).toBe('https://api.anthropic.com')
    expect(config.providers.google.apiKey).toBe('')
  })

  it('provides default model costs', () => {
    const config = AIWrapperConfigSchema.parse({})

    expect(config.modelCosts['gpt-4o']).toEqual({ input: 0.25, output: 1.0 })
    expect(config.modelCosts['claude-opus-4-6']).toEqual({ input: 1.5, output: 7.5 })
    expect(config.modelCosts['gemini-2.0-flash']).toEqual({ input: 0.015, output: 0.06 })
  })

  it('accepts valid custom config', () => {
    const config = AIWrapperConfigSchema.parse({
      enabled: true,
      defaultProvider: 'anthropic',
      defaultModel: 'claude-sonnet-4-6',
      dailyTokenLimit: 100000,
      defaultTemperature: 0.5,
      providers: {
        anthropic: { apiKey: 'sk-ant-test' },
      },
    })

    expect(config.enabled).toBe(true)
    expect(config.defaultProvider).toBe('anthropic')
    expect(config.defaultModel).toBe('claude-sonnet-4-6')
    expect(config.dailyTokenLimit).toBe(100000)
    expect(config.providers.anthropic.apiKey).toBe('sk-ant-test')
    // OpenAI defaults still present
    expect(config.providers.openai.apiKey).toBe('')
  })

  it('rejects invalid provider', () => {
    expect(() =>
      AIWrapperConfigSchema.parse({ defaultProvider: 'invalid' })
    ).toThrow()
  })

  it('rejects temperature out of range', () => {
    expect(() =>
      AIWrapperConfigSchema.parse({ defaultTemperature: 3.0 })
    ).toThrow()

    expect(() =>
      AIWrapperConfigSchema.parse({ defaultTemperature: -1 })
    ).toThrow()
  })

  it('accepts temperature at boundaries', () => {
    const low = AIWrapperConfigSchema.parse({ defaultTemperature: 0 })
    expect(low.defaultTemperature).toBe(0)

    const high = AIWrapperConfigSchema.parse({ defaultTemperature: 2 })
    expect(high.defaultTemperature).toBe(2)
  })

  it('allows custom model costs to override defaults', () => {
    const config = AIWrapperConfigSchema.parse({
      modelCosts: {
        'my-custom-model': { input: 0.5, output: 2.0 },
      },
    })

    expect(config.modelCosts['my-custom-model']).toEqual({ input: 0.5, output: 2.0 })
    // Custom costs completely replace defaults
    expect(config.modelCosts['gpt-4o']).toBeUndefined()
  })
})
