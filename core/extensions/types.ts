import { z } from 'zod'

/**
 * Extension Manifest Schema
 */
export const ExtensionManifestSchema = z.object({
  /** Unique extension identifier */
  id: z.string().regex(/^[a-z0-9-]+$/, 'ID must be lowercase alphanumeric with hyphens'),

  /** Display name */
  name: z.string().min(1),

  /** Semantic version */
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Must be semver format'),

  /** Description */
  description: z.string().default(''),

  /** Author */
  author: z.string().default(''),

  /** Extension entry point (relative to extension directory) */
  main: z.string().default('index.ts'),

  /** Minimum Unblocks version required */
  minUnblocksVersion: z.string().optional(),

  /** Dependencies on other extensions */
  dependencies: z.array(z.string()).default([]),

  /** Config schema file (relative to extension directory) */
  configFile: z.string().optional(),

  /** Database schema file (relative to extension directory) */
  schemaFile: z.string().optional(),

  /** Hooks this extension provides */
  hooks: z.array(z.string()).default([]),

  /** API routes this extension registers */
  routes: z.array(z.object({
    method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
    path: z.string(),
    handler: z.string(),
  })).default([]),

  /** Whether this extension is enabled by default */
  enabled: z.boolean().default(true),
})

export type ExtensionManifest = z.infer<typeof ExtensionManifestSchema>

export interface LoadedExtension {
  manifest: ExtensionManifest
  directory: string
  config: unknown
  initialized: boolean
}

export interface ExtensionContext {
  /** Extension config (loaded from its config file) */
  config: unknown
  /** Database instance */
  db: unknown
  /** Logger scoped to the extension */
  log: (message: string, ...args: unknown[]) => void
  /** Register a hook handler */
  registerHook: (name: string, handler: (...args: unknown[]) => Promise<void>) => void
  /** Enqueue a background job */
  enqueueJob: (type: string, payload: unknown) => Promise<string>
}
