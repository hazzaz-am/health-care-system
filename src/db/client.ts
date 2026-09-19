import { PrismaClient } from '../generated/prisma/client.js'
import { PrismaPg } from '@prisma/adapter-pg'
import { env, isProduction } from '../config/env.js'
import { logger } from '../config/logger.js'

/**
 * Prisma 7 requires an explicit driver adapter — there is no built-in engine
 * that connects on its own. The `pg` driver also owns connection pooling now,
 * and its defaults differ from Prisma 6 (notably: no connection timeout at
 * all), so the pool is configured explicitly rather than left to chance.
 */
const adapter = new PrismaPg({
  connectionString: env.DATABASE_URL,
  max: 10,
  connectionTimeoutMillis: 5_000,
  idleTimeoutMillis: 30_000,
})

export const prisma = new PrismaClient({
  adapter,
  log: isProduction
    ? [{ emit: 'event', level: 'error' }]
    : [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'warn' },
        { emit: 'event', level: 'error' },
      ],
})

prisma.$on('error', (event) => {
  logger.error({ prisma: event }, 'prisma error')
})

if (!isProduction) {
  prisma.$on('warn', (event) => {
    logger.warn({ prisma: event }, 'prisma warning')
  })
}
