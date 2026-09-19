import { once } from 'node:events'
import type { Server } from 'node:http'
import { createApp } from './app.js'
import { env } from './config/env.js'
import { logger } from './config/logger.js'
import { prisma } from './db/client.js'

/** How long in-flight requests get to finish before we stop waiting. */
const SHUTDOWN_GRACE_MS = 8_000

const app = createApp()
const server: Server = app.listen(env.PORT, () => {
  logger.info(
    { port: env.PORT, env: env.NODE_ENV, pid: process.pid },
    `server listening on http://localhost:${env.PORT}`,
  )
})

server.on('error', (error) => {
  logger.fatal({ err: error }, 'server error')
  process.exit(1)
})

/**
 * Graceful shutdown.
 *
 * `server.close()` alone stops new connections but hangs until every keep-alive
 * socket closes, so `closeIdleConnections()` is what actually lets the process
 * exit promptly under a load balancer that holds connections open.
 */
let shuttingDown = false

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return
  shuttingDown = true

  logger.info({ signal }, 'shutdown started')

  const forceExit = setTimeout(() => {
    logger.error('graceful shutdown timed out, forcing exit')
    server.closeAllConnections()
    process.exit(1)
  }, SHUTDOWN_GRACE_MS)
  forceExit.unref()

  try {
    server.close()
    server.closeIdleConnections()
    await once(server, 'close')
    logger.info('http server closed')

    await prisma.$disconnect()
    logger.info('database connections closed')

    clearTimeout(forceExit)
    logger.info('shutdown complete')
    process.exit(0)
  } catch (error) {
    logger.error({ err: error }, 'error during shutdown')
    process.exit(1)
  }
}

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    void shutdown(signal)
  })
}

/**
 * A rejected promise that nothing handled means application state is unknown.
 * Logging and exiting is safer than continuing to serve traffic, so a
 * supervisor can restart a clean process.
 */
process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'unhandled promise rejection')
  void shutdown('unhandledRejection')
})

process.on('uncaughtException', (error) => {
  logger.fatal({ err: error }, 'uncaught exception')
  void shutdown('uncaughtException')
})
