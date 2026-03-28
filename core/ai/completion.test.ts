import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderTemplate } from './completion'

// Mock dependencies for complete()
vi.mock('../runtime/hookRunner', () => ({
  runHook: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('./usage', () => ({
  trackUsage: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('./providers', () => ({
  getProviderFn: vi.fn().mockReturnValue(
    vi.fn().mockResolvedValue({
      id: 'test-id',
      model: 'gpt-4o',
      content: 'Hello, world!',
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      finishReason: 'stop',
      latencyMs: 100,
    })
  ),
}))

describe('renderTemplate', () => {
  it('replaces template variables', () => {
    const result = renderTemplate('Hello {{name}}, welcome to {{place}}!', {
      name: 'Alice',
      place: 'Wonderland',
    })
    expect(result).toBe('Hello Alice, welcome to Wonderland!')
  })

  it('replaces multiple occurrences of the same variable', () => {
    const result = renderTemplate('{{x}} + {{x}} = 2{{x}}', { x: '1' })
    expect(result).toBe('1 + 1 = 21')
  })

  it('leaves unmatched variables as-is', () => {
    const result = renderTemplate('Hello {{name}}', {})
    expect(result).toBe('Hello {{name}}')
  })

  it('handles empty template', () => {
    const result = renderTemplate('', { name: 'test' })
    expect(result).toBe('')
  })

  it('handles empty variables', () => {
    const result = renderTemplate('no variables here', {})
    expect(result).toBe('no variables here')
  })
})

vi.mock('./ai.config', () => ({
  default: {
    enabled: true,
    defaultProvider: 'openai',
    defaultModel: 'gpt-4o',
    defaultTemperature: 0.7,
    maxTokensPerRequest: 4096,
    trackUsage: true,
    providers: {
      openai: { apiKey: 'sk-test-key', baseUrl: 'https://api.openai.com/v1' },
      anthropic: { apiKey: 'sk-ant-test', baseUrl: 'https://api.anthropic.com' },
      google: { apiKey: 'google-test' },
    },
    modelCosts: {
      'gpt-4o': { input: 0.25, output: 1.0 },
    },
  },
}))

import { complete } from './completion'
import { getProviderFn } from './providers'
import { trackUsage } from './usage'
import { runHook } from '../runtime/hookRunner'

const mockGetProviderFn = getProviderFn as ReturnType<typeof vi.fn>
const mockTrackUsage = trackUsage as ReturnType<typeof vi.fn>
const mockRunHook = runHook as ReturnType<typeof vi.fn>

describe('complete', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetProviderFn.mockReturnValue(
      vi.fn().mockResolvedValue({
        id: 'test-id',
        model: 'gpt-4o',
        content: 'Hello, world!',
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: 'stop',
        latencyMs: 100,
      })
    )
  })

  it('returns a completion response', async () => {
    const result = await complete({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Hello' }],
      userId: 'user-1',
    })

    expect(result.content).toBe('Hello, world!')
    expect(result.usage.totalTokens).toBe(15)
    expect(result.finishReason).toBe('stop')
  })

  it('detects openai provider from gpt model prefix', async () => {
    await complete({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Hi' }],
    })

    expect(mockGetProviderFn).toHaveBeenCalledWith('openai')
  })

  it('detects anthropic provider from claude model prefix', async () => {
    await complete({
      model: 'claude-sonnet-4-6',
      messages: [{ role: 'user', content: 'Hi' }],
    })

    expect(mockGetProviderFn).toHaveBeenCalledWith('anthropic')
  })

  it('detects google provider from gemini model prefix', async () => {
    await complete({
      model: 'gemini-2.0-flash',
      messages: [{ role: 'user', content: 'Hi' }],
    })

    expect(mockGetProviderFn).toHaveBeenCalledWith('google')
  })

  it('tracks usage when trackUsage is enabled and userId provided', async () => {
    await complete({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Hello' }],
      userId: 'user-1',
    })

    expect(mockTrackUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        model: 'gpt-4o',
        provider: 'openai',
        totalTokens: 15,
      })
    )
  })

  it('skips usage tracking when no userId', async () => {
    await complete({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Hello' }],
    })

    expect(mockTrackUsage).not.toHaveBeenCalled()
  })

  it('fires onAICompletion hook', async () => {
    await complete({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Hello' }],
      userId: 'user-1',
    })

    expect(mockRunHook).toHaveBeenCalledWith('onAICompletion', {
      userId: 'user-1',
      model: 'gpt-4o',
      tokens: 15,
      latencyMs: 100,
    })
  })

  it('applies default temperature from config', async () => {
    await complete({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Hello' }],
    })

    const providerFn = mockGetProviderFn.mock.results[0].value
    const callArgs = providerFn.mock.calls[0][0]
    expect(callArgs.temperature).toBe(0.7)
  })

  it('caps maxTokens to config limit', async () => {
    await complete({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Hello' }],
      maxTokens: 999999,
    })

    const providerFn = mockGetProviderFn.mock.results[0].value
    const callArgs = providerFn.mock.calls[0][0]
    expect(callArgs.maxTokens).toBe(4096)
  })
})
