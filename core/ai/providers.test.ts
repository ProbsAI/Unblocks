import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getProviderFn, openaiCompletion, anthropicCompletion } from './providers'
import type { CompletionRequest } from './types'

const baseRequest: CompletionRequest = {
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello' }],
  temperature: 0.7,
  maxTokens: 100,
}

describe('getProviderFn', () => {
  it('returns openaiCompletion for openai provider', () => {
    expect(getProviderFn('openai')).toBe(openaiCompletion)
  })

  it('returns openaiCompletion for custom provider', () => {
    expect(getProviderFn('custom')).toBe(openaiCompletion)
  })

  it('returns anthropicCompletion for anthropic provider', () => {
    expect(getProviderFn('anthropic')).toBe(anthropicCompletion)
  })

  it('returns openaiCompletion for google provider (compatibility layer)', () => {
    expect(getProviderFn('google')).toBe(openaiCompletion)
  })

  it('throws for unsupported provider', () => {
    expect(() => getProviderFn('invalid' as never)).toThrow('Unsupported AI provider')
  })
})

describe('openaiCompletion', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('sends correct request format to OpenAI API', async () => {
    const mockResponse = {
      id: 'chatcmpl-123',
      model: 'gpt-4o',
      choices: [{ message: { content: 'Hi there!' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
    }

    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    } as Response)

    const result = await openaiCompletion(baseRequest, 'sk-test', 'https://api.openai.com/v1')

    expect(result.content).toBe('Hi there!')
    expect(result.usage.totalTokens).toBe(8)
    expect(result.finishReason).toBe('stop')
    expect(result.latencyMs).toBeGreaterThanOrEqual(0)

    expect(fetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer sk-test',
        }),
      })
    )
  })

  it('throws on API error', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve('Unauthorized'),
    } as Response)

    await expect(
      openaiCompletion(baseRequest, 'bad-key', 'https://api.openai.com/v1')
    ).rejects.toThrow('OpenAI API error (401)')
  })
})

describe('anthropicCompletion', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('sends correct request format to Anthropic API', async () => {
    const mockResponse = {
      id: 'msg_123',
      model: 'claude-sonnet-4-6',
      content: [{ text: 'Hello!' }],
      usage: { input_tokens: 5, output_tokens: 3 },
      stop_reason: 'end_turn',
    }

    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    } as Response)

    const anthropicRequest = {
      ...baseRequest,
      model: 'claude-sonnet-4-6',
      messages: [
        { role: 'system' as const, content: 'You are helpful.' },
        { role: 'user' as const, content: 'Hello' },
      ],
    }

    const result = await anthropicCompletion(
      anthropicRequest, 'sk-ant-test', 'https://api.anthropic.com'
    )

    expect(result.content).toBe('Hello!')
    expect(result.usage.promptTokens).toBe(5)
    expect(result.usage.completionTokens).toBe(3)

    expect(fetch).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/messages',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'x-api-key': 'sk-ant-test',
          'anthropic-version': '2023-06-01',
        }),
      })
    )
  })
})
