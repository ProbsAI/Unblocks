import { discoverExtensions, validateDependencies } from './loader'
import { registerHook } from '../runtime/hookRunner'
import { getDb } from '../db/client'
import { enqueueJob } from '../jobs/queue'
import type { LoadedExtension, ExtensionContext } from './types'

let _extensions: LoadedExtension[] = []
let _initialized = false

/**
 * Initialize the extension system.
 * Discovers, validates, and initializes all extensions.
 */
export async function initializeExtensions(): Promise<void> {
  if (_initialized) return

  _extensions = discoverExtensions()

  // Validate dependencies
  const depErrors = validateDependencies(_extensions)
  if (depErrors.length > 0) {
    for (const err of depErrors) {
      console.error(
        `[extensions] ${err.extension} missing dependencies: ${err.missing.join(', ')}`
      )
    }
    // Remove extensions with unmet dependencies
    const broken = new Set(depErrors.map((e) => e.extension))
    _extensions = _extensions.filter((e) => !broken.has(e.manifest.id))
  }

  // Initialize each extension
  for (const ext of _extensions) {
    try {
      await initializeExtension(ext)
    } catch (err) {
      console.error(`[extensions] Failed to initialize ${ext.manifest.id}:`, err)
    }
  }

  _initialized = true
  console.log(
    `[extensions] Loaded ${_extensions.filter((e) => e.initialized).length} extensions`
  )
}

/**
 * Get all loaded extensions.
 */
export function getExtensions(): LoadedExtension[] {
  return [..._extensions]
}

/**
 * Get an extension by ID.
 */
export function getExtension(id: string): LoadedExtension | undefined {
  return _extensions.find((e) => e.manifest.id === id)
}

/**
 * Check if an extension is loaded and initialized.
 */
export function isExtensionLoaded(id: string): boolean {
  const ext = _extensions.find((e) => e.manifest.id === id)
  return ext?.initialized ?? false
}

/**
 * Reset the extension system. Used for testing.
 */
export function resetExtensions(): void {
  _extensions = []
  _initialized = false
}

async function initializeExtension(ext: LoadedExtension): Promise<void> {
  const context: ExtensionContext = {
    config: ext.config,
    db: getDb(),
    log: (message: string, ...args: unknown[]) => {
      console.log(`[ext:${ext.manifest.id}] ${message}`, ...args)
    },
    registerHook: (name: string, handler: (...args: unknown[]) => Promise<void>) => {
      registerHook(name, handler as (args: unknown) => Promise<unknown>)
    },
    enqueueJob: async (type: string, payload: unknown) => {
      return enqueueJob({
        type: `ext:${ext.manifest.id}:${type}`,
        payload,
      })
    },
  }

  // Try to load and run the extension's main entry point
  try {
    const mainPath = `${ext.directory}/${ext.manifest.main}`
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require(mainPath)
    const init = mod.default ?? mod.initialize

    if (typeof init === 'function') {
      await init(context)
    }

    ext.initialized = true
  } catch (err) {
    console.error(`[extensions] Error loading ${ext.manifest.id}:`, err)
  }
}
