/**
 * Block Registry
 *
 * Central registry for premium blocks. Premium blocks (installed via npm packages
 * from the private registry) call `registerBlock()` at import time. API routes
 * use `tryRequireBlock()` to gracefully handle missing blocks.
 *
 * When a block is not found in the registry, `tryRequireBlock()` and
 * `requireBlock()` attempt a dynamic `require()` of the corresponding
 * `@unblocks/block-<id>` package. The package's entry point is expected to
 * call `registerBlock()` as a side effect, which populates the registry for
 * subsequent lookups.
 *
 * This module is MIT-licensed and part of core. It provides the interface;
 * premium block packages provide the implementations.
 */

export interface BlockRegistration {
  /** Unique block identifier (e.g. 'ai-wrapper') */
  id: string
  /** Display name */
  name: string
  /** Semver version string */
  version: string
  /** Block's exported API surface */
  exports: Record<string, unknown>
  /** Drizzle schema tables (if any) */
  schemas?: Record<string, unknown>
}

const registry = new Map<string, BlockRegistration>()

/**
 * Attempt to dynamically load a block package so its top-level
 * `registerBlock()` side-effect populates the registry.
 */
function attemptAutoLoad(id: string): void {
  if (registry.has(id)) return
  try {
    // Block packages are expected to call registerBlock() at import time.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require(`@unblocks/block-${id}`)
  } catch (err: unknown) {
    // MODULE_NOT_FOUND means the package is not installed — that's fine.
    if (err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'MODULE_NOT_FOUND') {
      return
    }
    // Any other error (e.g. syntax error in the block) should surface.
    throw err
  }
}

/**
 * Register a premium block. Called by block packages at import time.
 *
 * @example
 * ```typescript
 * // Inside @unblocks/block-ai-wrapper/index.ts
 * import { registerBlock } from '@unblocks/core/runtime/blockRegistry'
 * registerBlock({
 *   id: 'ai-wrapper',
 *   name: 'AI Wrapper',
 *   version: '0.2.0',
 *   exports: { complete, renderTemplate, trackUsage, getUserUsage, getUsageHistory },
 * })
 * ```
 */
export function registerBlock(block: BlockRegistration): void {
  if (registry.has(block.id)) {
    console.warn(`[blocks] Block "${block.id}" is already registered, overwriting`)
  }
  registry.set(block.id, block)
}

/**
 * Check if a block is installed and registered.
 * Attempts to auto-load the package if not yet in the registry.
 */
export function isBlockAvailable(id: string): boolean {
  attemptAutoLoad(id)
  return registry.has(id)
}

/**
 * Get a block's exports. Returns null if the block is not installed.
 * Use this in routes/pages for graceful degradation.
 *
 * On first call for a given block, attempts to dynamically load the
 * `@unblocks/block-<id>` package so its `registerBlock()` side-effect
 * populates the registry.
 */
export function tryRequireBlock<T = Record<string, unknown>>(id: string): T | null {
  attemptAutoLoad(id)
  const block = registry.get(id)
  if (!block) return null
  return block.exports as T
}

/**
 * Get a block's exports. Throws if the block is not installed.
 * Use this when the block is required (not optional).
 */
export function requireBlock<T = Record<string, unknown>>(id: string): T {
  attemptAutoLoad(id)
  const block = registry.get(id)
  if (!block) {
    throw new Error(
      `Block "${id}" is not installed. Install it via: npm install @unblocks/block-${id}`
    )
  }
  return block.exports as T
}

/**
 * Get block metadata (without exports).
 */
export function getBlockInfo(id: string): Omit<BlockRegistration, 'exports' | 'schemas'> | null {
  attemptAutoLoad(id)
  const block = registry.get(id)
  if (!block) return null
  return { id: block.id, name: block.name, version: block.version }
}

/**
 * List all registered blocks.
 */
export function getRegisteredBlocks(): Array<{ id: string; name: string; version: string }> {
  return Array.from(registry.values()).map(({ id, name, version }) => ({ id, name, version }))
}

/**
 * Get all registered block schemas (for drizzle config).
 */
export function getBlockSchemas(): Record<string, unknown>[] {
  return Array.from(registry.values())
    .filter((b) => b.schemas)
    .map((b) => b.schemas!)
}

/**
 * Reset the registry. Used for testing.
 */
export function resetBlockRegistry(): void {
  registry.clear()
}
