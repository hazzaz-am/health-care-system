import type { PrismaClient } from '../../generated/prisma/client.js'
import { prisma } from '../../db/client.js'
import { isProduction } from '../../config/env.js'

export interface ReadinessResult {
  status: 'ok' | 'error'
  checks: {
    database: {
      status: 'ok' | 'error'
      latencyMs: number
      error?: string
    }
  }
}

/**
 * Readiness probe: verifies the database actually answers a trivial query.
 *
 * The timeout is enforced with Promise.race rather than relying on the driver,
 * because a hung TCP connection otherwise holds the probe open indefinitely —
 * which is exactly the failure mode readiness checks exist to catch.
 */
export async function checkReadiness(
  timeoutMs: number,
  client: PrismaClient = prisma,
): Promise<ReadinessResult> {
  const startedAt = performance.now()

  try {
    await withTimeout(client.$queryRaw`SELECT 1`, timeoutMs, 'Database readiness probe timed out')

    return {
      status: 'ok',
      checks: {
        database: {
          status: 'ok',
          latencyMs: Math.round(performance.now() - startedAt),
        },
      },
    }
  } catch (error) {
    return {
      status: 'error',
      checks: {
        database: {
          status: 'error',
          latencyMs: Math.round(performance.now() - startedAt),
          // /readyz is unauthenticated, so raw driver output (which can name
          // users, hosts, and databases) is exposed only outside production.
          // The full error is logged by the caller either way.
          error: isProduction
            ? 'Database probe failed'
            : error instanceof Error
              ? error.message
              : 'Unknown database error',
        },
      },
    }
  }
}

async function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined

  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(message)), ms)
      }),
    ])
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}
