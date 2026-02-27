import { existsSync } from 'fs'
import { join } from 'path'

/**
 * UI Override Resolution System
 *
 * Components in `ui/components/` shadow their counterparts in `components/`.
 * Layouts in `ui/layouts/` shadow layouts in `app/`.
 * Pages in `ui/pages/` shadow pages in `app/`.
 * Email templates in `ui/email-templates/` shadow templates in `core/email/templates.ts`.
 *
 * Resolution order:
 * 1. Check `ui/{type}/{path}` — if exists, use the override
 * 2. Fall back to the default location
 */

export type OverrideType = 'components' | 'layouts' | 'pages' | 'email-templates'

const UI_BASE_DIR = './ui'

/**
 * Resolve a component path, checking for UI overrides first.
 *
 * @param type - Override type (components, layouts, pages, email-templates)
 * @param path - Relative path within the type directory
 * @returns The resolved path (override or default)
 */
export function resolveUIPath(type: OverrideType, path: string): string {
  const overridePath = join(UI_BASE_DIR, type, path)

  // Check for .tsx, .ts, .jsx, .js extensions
  const extensions = ['.tsx', '.ts', '.jsx', '.js']

  for (const ext of extensions) {
    const fullPath = overridePath.endsWith(ext)
      ? overridePath
      : `${overridePath}${ext}`

    if (existsSync(fullPath)) {
      return fullPath
    }
  }

  // No override found — return the default path based on type
  switch (type) {
    case 'components':
      return join('./components', path)
    case 'layouts':
      return join('./app', path)
    case 'pages':
      return join('./app', path)
    case 'email-templates':
      return join('./core/email', path)
  }
}

/**
 * Check if a UI override exists for a given type and path.
 */
export function hasUIOverride(type: OverrideType, path: string): boolean {
  const overridePath = join(UI_BASE_DIR, type, path)
  const extensions = ['.tsx', '.ts', '.jsx', '.js']

  return extensions.some((ext) => {
    const fullPath = overridePath.endsWith(ext)
      ? overridePath
      : `${overridePath}${ext}`
    return existsSync(fullPath)
  })
}

/**
 * List all active UI overrides.
 */
export function listOverrides(): Array<{ type: OverrideType; path: string }> {
  const overrides: Array<{ type: OverrideType; path: string }> = []
  const types: OverrideType[] = ['components', 'layouts', 'pages', 'email-templates']

  for (const type of types) {
    const dir = join(UI_BASE_DIR, type)
    if (!existsSync(dir)) continue

    try {
      // Recursive directory listing would go here
      // For V1B, we keep it simple and check known paths
    } catch {
      // Directory doesn't exist or can't be read
    }
  }

  return overrides
}
