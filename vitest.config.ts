import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Integration tests touch a shared egress/database; running files in
    // separate processes keeps module-level state (rate limiter, Prisma pool)
    // from leaking between suites.
    pool: 'forks',
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/healthcare_test?schema=public',
    },
    testTimeout: 15_000,
    hookTimeout: 15_000,
  },
})
