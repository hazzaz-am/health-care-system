import { existsSync } from 'node:fs'
import { defineConfig, type ViteUserConfig } from 'vitest/config'

// Mirror how the app runs: pick up `.env` if it is there, so the suite talks to
// the same database as `pnpm dev` instead of a hardcoded guess. `loadEnvFile`
// never overrides variables already set, so CI stays in control.
if (existsSync('.env')) {
  process.loadEnvFile('.env')
}

/**
 * Shared settings for both test configs. `vitest.db.config.ts` reuses this
 * verbatim, so the only difference between `pnpm test` and `pnpm test:db` is
 * the `.db.test.ts` exclusion applied below.
 */
export const sharedTestConfig: NonNullable<ViteUserConfig['test']> = {
  environment: 'node',
  include: ['tests/**/*.test.ts'],
  // Integration tests touch a shared egress/database; running files in separate
  // processes keeps module-level state (rate limiter, Prisma pool) from leaking
  // between suites.
  pool: 'forks',
  env: {
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    // `.env` wins when present; the fallback keeps a fresh clone working
    // against a conventional local test database.
    DATABASE_URL:
      process.env.DATABASE_URL ??
      'postgresql://postgres:postgres@localhost:5432/healthcare_test?schema=public',
  },
  testTimeout: 15_000,
  hookTimeout: 15_000,
}

export default defineConfig({
  test: {
    ...sharedTestConfig,
    // Tests needing a live database are kept out of `pnpm test`, which must stay
    // runnable on a fresh clone. `pnpm test:db` uses the other config.
    exclude: ['**/node_modules/**', '**/dist/**', 'tests/**/*.db.test.ts'],
  },
})
