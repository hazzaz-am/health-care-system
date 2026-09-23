import { defineConfig } from 'vitest/config'
import { sharedTestConfig } from './vitest.config.js'

/**
 * The same suite as `vitest.config.ts`, minus the `.db.test.ts` exclusion — so
 * `pnpm test:db` runs the database-backed tests that `pnpm test` skips.
 *
 * Requires a migrated database reachable at `DATABASE_URL` (`.env` is loaded by
 * the shared config).
 */
export default defineConfig({
  test: {
    ...sharedTestConfig,
  },
})
