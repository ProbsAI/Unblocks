import aiConfig from './ai.config'
import { runHook } from '../runtime/hookRunner'
import { getProviderFn } from './providers'
import { trackUsage } from './usage'
import { AIWrapperConfigSchema } from './types'
import type { CompletionRequest, CompletionResponse, AIProvider, AIWrapperConfig } from './types'

/**
 * Load and validate the AI config.
 *
 * This previously used require() inside a try/catch. In an ESM module require is
 * not defined, so the call threw on every invocation and the catch silently
 * returned schema defaults — meaning ai.config.ts was never actually read and
 * the configured provider keys, model costs and enabled flag were all ignored.
 * A static import both fixes that and lets tests mock the module.
 */
function loadAIConfig(): AIWrapperConfig {
  return AIWrapperConfigSchema.parse(aiConfig)
}

/**
 * Send a completion request through the AI wrapper.
 * Handles provider routing, usage tracking, and hooks.
 */
export async function complete(
  request: CompletionRequest
): Promise<CompletionResponse> {
  const config = loadAIConfig()

  // Honour the kill switch. The flag was parsed but never consulted, so setting
  // enabled: false still sent every request to the provider — and the endpoint
  // became publicly reachable in this change.
  if (!config.enabled) {
    throw new Error('AI completion is disabled (set enabled: true in ai.config)')
  }

  // Resolve the model here rather than at each call site. Callers that omit it
  // previously had to supply their own literal, which meant config.defaultModel
  // was never consulted by anything.
  const model = request.model || config.defaultModel

  // Determine provider from model or config
  const provider = detectProvider(model, config.defaultProvider as AIProvider)

  // Get provider credentials
  const { apiKey, baseUrl } = getProviderCredentials(provider, config as unknown as Record<string, unknown>)

  if (!apiKey) {
    throw new Error(`No API key configured for provider: ${provider}`)
  }

  // Apply defaults
  const fullRequest: CompletionRequest = {
    ...request,
    model,
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
