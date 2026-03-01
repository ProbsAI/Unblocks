import type { HookName, HookRegistry } from './types'

const hookRegistry: HookRegistry = {}

export function registerHook(
  name: HookName,
  handler: (args: unknown) => Promise<unknown>
): void {
  if (!hookRegistry[name]) {
    hookRegistry[name] = []
  }
  hookRegistry[name].push(handler)
}

export async function runHook(
  name: HookName,
  args: unknown
): Promise<void> {
  const handlers = hookRegistry[name]
  if (!handlers || handlers.length === 0) return

  for (const handler of handlers) {
    try {
      await handler(args)
    } catch (error) {
      // Hook errors are logged but never crash the app
      console.error(`Hook "${name}" error:`, error)

      // Try to fire onError hook (but avoid infinite recursion)
      if (name !== 'onError') {
        try {
          await runHook('onError', { error, hookName: name, args })
        } catch {
          // Silently fail — onError hook itself errored
        }
      }
    }
  }
}

export async function runBeforeHook<T>(
  name: HookName,
  args: T
): Promise<T> {
  const handlers = hookRegistry[name]
  if (!handlers || handlers.length === 0) return args

  let result = args
  for (const handler of handlers) {
    try {
      const modified = await handler(result)
      if (modified != null) {
        result = modified as T
      }
    } catch (error) {
      console.error(`Before hook "${name}" error:`, error)
    }
  }

  return result
}

export function clearHooks(): void {
  for (const key of Object.keys(hookRegistry)) {
    delete hookRegistry[key]
  }
}

export function getRegisteredHooks(): string[] {
  return Object.keys(hookRegistry)
}
