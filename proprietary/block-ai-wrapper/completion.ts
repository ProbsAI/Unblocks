import { loadConfig } from '../../core/runtime/configLoader'
import { runHook } from '../../core/runtime/hookRunner'
import { getProviderFn } from './providers'
import { trackUsage } from './usage'
import type { CompletionRequest, CompletionResponse, AIProvider } from './types'

/**
 * Send a completion request through the AI wrapper.
 * Handles provider routing, usage tracking, and hooks.
 */
export async function complete(
  request: CompletionRequest
): Promise<CompletionResponse> {
  const config = loadConfig('ai') as ReturnType<typeof loadConfig>

  // Determine provider from model or config
  const provider = detectProvider(request.model, config.defaultProvider as AIProvider)

  // Get provider credentials
  const { apiKey, baseUrl } = getProviderCredentials(provider, config)

  if (!apiKey) {
    throw new Error(`No API key configured for provider: ${provider}`)
  }

  // Apply defaults
  const fullRequest: CompletionRequest = {
    ...request,
    temperature: request.temperature ?? config.defaultTemperature,
    maxTokens: Math.min(
      request.maxTokens ?? config.maxTokensPerRequest,
      config.maxTokensPerRequest
    ),
  }

  // Execute completion
  const providerFn = getProviderFn(provider)
  const response = await providerFn(fullRequest, apiKey, baseUrl)

  // Track usage
  if (config.trackUsage && request.userId) {
    await trackUsage({
      userId: request.userId,
      model: response.model,
      provider,
      promptTokens: response.usage.promptTokens,
      completionTokens: response.usage.completionTokens,
      totalTokens: response.usage.totalTokens,
      latencyMs: response.latencyMs,
      metadata: request.metadata ?? {},
    })
  }

  // Fire hook
  await runHook('onAICompletion', {
    userId: request.userId,
    model: response.model,
    tokens: response.usage.totalTokens,
    latencyMs: response.latencyMs,
  })

  return response
}

/**
 * Render a prompt template with variables.
 */
export function renderTemplate(
  template: string,
  variables: Record<string, string>
): string {
  let result = template
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
  }
  return result
}

function detectProvider(model: string, defaultProvider: AIProvider): AIProvider {
  if (model.startsWith('gpt-') || model.startsWith('o1') || model.startsWith('o3')) {
    return 'openai'
  }
  if (model.startsWith('claude-')) {
    return 'anthropic'
  }
  if (model.startsWith('gemini-')) {
    return 'google'
  }
  return defaultProvider
}

function getProviderCredentials(
  provider: AIProvider,
  config: Record<string, unknown>
): { apiKey: string; baseUrl: string } {
  const providers = config.providers as Record<string, Record<string, string>>

  switch (provider) {
    case 'openai':
    case 'custom':
      return {
        apiKey: providers?.openai?.apiKey ?? '',
        baseUrl: providers?.openai?.baseUrl ?? 'https://api.openai.com/v1',
      }
    case 'anthropic':
      return {
        apiKey: providers?.anthropic?.apiKey ?? '',
        baseUrl: providers?.anthropic?.baseUrl ?? 'https://api.anthropic.com',
      }
    case 'google':
      return {
        apiKey: providers?.google?.apiKey ?? '',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
      }
    default:
      return { apiKey: '', baseUrl: '' }
  }
}
