import { existsSync, readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { ExtensionManifestSchema } from './types'
import type { LoadedExtension, ExtensionManifest } from './types'

const EXTENSIONS_DIR = './extensions'

/**
 * Discover and load all extensions from the extensions directory.
 * Each extension must have a manifest.json file.
 */
export function discoverExtensions(): LoadedExtension[] {
  if (!existsSync(EXTENSIONS_DIR)) {
    return []
  }

  const entries = readdirSync(EXTENSIONS_DIR, { withFileTypes: true })
  const extensions: LoadedExtension[] = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue

    const extDir = join(EXTENSIONS_DIR, entry.name)
    const manifestPath = join(extDir, 'manifest.json')

    if (!existsSync(manifestPath)) continue

    try {
      const raw = readFileSync(manifestPath, 'utf-8')
      const parsed = JSON.parse(raw)
      const result = ExtensionManifestSchema.safeParse(parsed)

      if (!result.success) {
        console.error(
          `[extensions] Invalid manifest for ${entry.name}:`,
          result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')
        )
        continue
      }

      if (!result.data.enabled) continue

      extensions.push({
        manifest: result.data,
        directory: extDir,
        config: null,
        initialized: false,
      })
    } catch (err) {
      console.error(`[extensions] Failed to load ${entry.name}:`, err)
    }
  }

  // Sort by dependencies (topological sort)
  return sortByDependencies(extensions)
}

/**
 * Validate that all extension dependencies are satisfied.
 */
export function validateDependencies(
  extensions: LoadedExtension[]
): Array<{ extension: string; missing: string[] }> {
  const ids = new Set(extensions.map((e) => e.manifest.id))
  const errors: Array<{ extension: string; missing: string[] }> = []

  for (const ext of extensions) {
    const missing = ext.manifest.dependencies.filter((dep) => !ids.has(dep))
    if (missing.length > 0) {
      errors.push({ extension: ext.manifest.id, missing })
    }
  }

  return errors
}

function sortByDependencies(extensions: LoadedExtension[]): LoadedExtension[] {
  const sorted: LoadedExtension[] = []
  const visited = new Set<string>()
  const visiting = new Set<string>()
  const byId = new Map(extensions.map((e) => [e.manifest.id, e]))

  function visit(ext: LoadedExtension): void {
    if (visited.has(ext.manifest.id)) return
    if (visiting.has(ext.manifest.id)) {
      console.error(`[extensions] Circular dependency detected: ${ext.manifest.id}`)
      return
    }

    visiting.add(ext.manifest.id)

    for (const dep of ext.manifest.dependencies) {
      const depExt = byId.get(dep)
      if (depExt) visit(depExt)
    }

    visiting.delete(ext.manifest.id)
    visited.add(ext.manifest.id)
    sorted.push(ext)
  }

  for (const ext of extensions) {
    visit(ext)
  }

  return sorted
}
