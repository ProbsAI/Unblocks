import { defineConfig } from 'drizzle-kit'
import { readdirSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'

// Core schema is always included. Premium block schemas are discovered
// dynamically from installed @unblocks/block-* packages.
function discoverBlockSchemaPaths(): string[] {
  const baseDir = join(process.cwd(), 'node_modules', '@unblocks')
  let dirNames: string[]
  try {
    dirNames = readdirSync(baseDir).filter((name) => {
      try {
        const stat = require('node:fs').statSync(join(baseDir, name))
        return stat.isDirectory() && name.startsWith('block-')
      } catch { return false }
    })
  } catch {
    return []
  }

  const results: string[] = []
  for (const name of dirNames) {
    for (const ext of ['ts', 'js'] as const) {
      const schemaPath = join(baseDir, name, `schema.${ext}`)
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
