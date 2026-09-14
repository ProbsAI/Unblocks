import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts'],
    // Integration tests need a live Postgres and run via
    // vitest.integration.config.ts, not in the unit suite.
    exclude: [
      'node_modules',
      '.next',
      'drizzle',
      '**/*.integration.test.ts',
    ],
    setupFiles: ['./blocks/testing/setup.ts'],
    testTimeout: 10_000,
    coverage: {
      provider: 'v8',
      include: ['core/**/*.ts', 'blocks/**/*.ts', 'lib/**/*.ts'],
      exclude: ['**/*.test.ts', '**/index.ts', '**/types.ts'],
      reporter: ['text', 'json-summary', 'lcov'],
    },
  },
  resolve: {
    alias: {
      '@unblocks/core': path.resolve(__dirname, './core'),
      '@unblocks/blocks': path.resolve(__dirname, './blocks'),
      '@': path.resolve(__dirname, '.'),
    },
  },
})
