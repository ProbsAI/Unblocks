import { defineConfig } from 'drizzle-kit'
import { readdirSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'

// Core schema is always included. Premium block schemas are discovered
// dynamically from installed @unblocks/block-* packages.
function discoverBlockSchemaPaths(): string[] {
  const baseDir = join(process.cwd(), 'node_modules', '@unblocks')
  let entries: ReturnType<typeof readdirSync>
  try {
    entries = readdirSync(baseDir, { withFileTypes: true })
  } catch {
    return []
  }

  const results: string[] = []
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith('block-')) continue
    for (const ext of ['ts', 'js'] as const) {
      const schemaPath = join(baseDir, entry.name, `schema.${ext}`)
      if (!existsSync(schemaPath)) continue
      let rel = relative(process.cwd(), schemaPath).replace(/\\/g, '/')
      if (!rel.startsWith('.')) rel = './' + rel
      results.push(rel)
    }
  }
  return results
}

const schemaPaths = [
  './core/db/schema/index.ts',
  ...discoverBlockSchemaPaths(),
]

export default defineConfig({
  schema: schemaPaths,
  out: './core/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
