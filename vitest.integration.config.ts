import { defineConfig } from 'vitest/config'
import path from 'path'

/**
 * Integration tests run against a real Postgres and are kept in a separate
 * project from the unit suite: they are slower, they need Docker, and they must
 * not run in parallel against one shared database.
 *
 *   docker compose up -d postgres_test
 *   npm run test:integration
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.integration.test.ts'],
    exclude: ['node_modules', '.next', 'drizzle'],
    setupFiles: ['./blocks/testing/setup.ts'],
    globalSetup: ['./blocks/testing/globalSetup.ts'],
    // One shared database means suites must not interleave their truncates.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
  resolve: {
    alias: {
      '@unblocks/core': path.resolve(__dirname, './core'),
      '@unblocks/blocks': path.resolve(__dirname, './blocks'),
      '@': path.resolve(__dirname, '.'),
    },
  },
})
