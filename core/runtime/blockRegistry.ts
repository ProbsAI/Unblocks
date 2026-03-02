/**
 * Block Registry
 *
 * Central registry for premium blocks. Premium blocks (installed via npm packages
 * from the private registry) call `registerBlock()` at import time. API routes
 * use `tryRequireBlock()` to gracefully handle missing blocks.
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
 */
export function isBlockAvailable(id: string): boolean {
  return registry.has(id)
}

/**
 * Get a block's exports. Returns null if the block is not installed.
 * Use this in routes/pages for graceful degradation.
 */
export function tryRequireBlock<T = Record<string, unknown>>(id: string): T | null {
  const block = registry.get(id)
  if (!block) return null
  return block.exports as T
}

/**
 * Get a block's exports. Throws if the block is not installed.
 * Use this when the block is required (not optional).
 */
export function requireBlock<T = Record<string, unknown>>(id: string): T {
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
