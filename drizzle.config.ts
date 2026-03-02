import { defineConfig } from 'drizzle-kit'
import { globSync } from 'glob'

// Core schema is always included. Premium block schemas are discovered
// dynamically from installed @unblocks/block-* packages.
const schemaPaths = [
  './core/db/schema/index.ts',
  ...globSync('./node_modules/@unblocks/block-*/schema.{ts,js}'),
]

export default defineConfig({
  schema: schemaPaths,
  out: './core/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
