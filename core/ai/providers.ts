import type { CompletionRequest, CompletionResponse, AIProvider } from './types'

/**
 * Send a completion request to OpenAI-compatible API.
 */
export async function openaiCompletion(
  request: CompletionRequest,
  apiKey: string,
  baseUrl: string
): Promise<CompletionResponse> {
  const startTime = Date.now()

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: request.model,
      messages: request.messages,
      temperature: request.temperature,
      max_tokens: request.maxTokens,
      top_p: request.topP,
      stream: false,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenAI API error (${response.status}): ${error}`)
  }

  const data = await response.json()
  const latencyMs = Date.now() - startTime

  return {
    id: data.id,
    model: data.model,
    content: data.choices[0]?.message?.content ?? '',
    usage: {
      promptTokens: data.usage?.prompt_tokens ?? 0,
      completionTokens: data.usage?.completion_tokens ?? 0,
      totalTokens: data.usage?.total_tokens ?? 0,
    },
    finishReason: data.choices[0]?.finish_reason ?? 'stop',
    latencyMs,
  }
}

/**
 * Send a completion request to Anthropic API.
 */
export async function anthropicCompletion(
  request: CompletionRequest,
  apiKey: string,
  baseUrl: string
): Promise<CompletionResponse> {
  const startTime = Date.now()

  // Extract system message
  const systemMsg = request.messages.find((m) => m.role === 'system')
  const otherMsgs = request.messages.filter((m) => m.role !== 'system')

  const response = await fetch(`${baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: request.model,
      system: systemMsg?.content,
      messages: otherMsgs.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      max_tokens: request.maxTokens ?? 4096,
      temperature: request.temperature,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Anthropic API error (${response.status}): ${error}`)
  }

  const data = await response.json()
  const latencyMs = Date.now() - startTime

  return {
    id: data.id,
    model: data.model,
    content: data.content[0]?.text ?? '',
    usage: {
      promptTokens: data.usage?.input_tokens ?? 0,
      completionTokens: data.usage?.output_tokens ?? 0,
      totalTokens: (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0),
    },
    finishReason: data.stop_reason ?? 'end_turn',
    latencyMs,
  }
}

/**
 * Get the provider completion function.
 */
export function getProviderFn(
  provider: AIProvider
): typeof openaiCompletion {
  switch (provider) {
    case 'openai':
    case 'custom':
      return openaiCompletion
    case 'anthropic':
      return anthropicCompletion
    case 'google':
      // Google uses OpenAI-compatible format via their compatibility layer
      return openaiCompletion
    default:
      throw new Error(`Unsupported AI provider: ${provider}`)
  }
}
