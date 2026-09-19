import express from 'express'
import type { Express, RequestHandler } from 'express'
import helmet from 'helmet'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import { env, isProduction, isTest } from './config/env.js'
import { requestLogger } from './middleware/requestLogger.js'
import { errorHandler, notFound } from './middleware/errorHandler.js'
import { healthRouter } from './routes/health.routes.js'
import { apiRouter } from './routes/index.js'

export interface CreateAppOptions {
  /** Escape hatch for tests: disable rate limiting and request logging. */
  disableRateLimit?: boolean
}

/**
 * Builds the Express application without binding a port.
 *
 * Keeping `listen()` out of this function is what makes the whole app testable
 * in-process: Supertest can drive it without a real socket or a free port.
 */
export function createApp(options: CreateAppOptions = {}): Express {
  const app = express()

  // Trust exactly one proxy hop (Nginx / ALB / Cloudflare). Without this,
  // express-rate-limit sees the proxy's IP for every request and throttles all
  // clients as if they were one. Must be set before the rate limiter.
  app.set('trust proxy', isProduction ? 1 : false)
  app.disable('x-powered-by')

  // 1. Correlation id + request logging (also opens the AsyncLocalStorage scope).
  app.use(requestLogger)

  // 2. Security headers.
  app.use(helmet())

  // 3. CORS. Credentials are allowed only for explicitly listed origins; the
  //    wildcard is never combined with credentials, which browsers reject.
  if (env.CORS_ORIGIN.length > 0) {
    app.use(
      cors({
        origin: env.CORS_ORIGIN,
        credentials: true,
        methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id'],
        exposedHeaders: ['x-request-id'],
      }),
    )
  }

  // 4. Body parsers with a hard size cap. An unbounded JSON body is a trivial
  //    memory-exhaustion vector.
  app.use(express.json({ limit: '1mb' }))
  app.use(express.urlencoded({ extended: true, limit: '1mb' }))

  // 5. Rate limiting, applied only to the API surface so health probes and
  //    static assets are never throttled.
  if (!isTest && !options.disableRateLimit) {
    app.use(
      '/api',
      rateLimit({
        windowMs: 60_000,
        limit: 100,
        standardHeaders: 'draft-8',
        legacyHeaders: false,
        message: {
          error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' },
        },
      }),
    )
  }

  // 6. Routes. Health lives outside /api on purpose: probes should not be
  //    subject to API versioning or API rate limits.
  app.use('/', healthRouter)
  app.use('/api/v1', apiRouter)

  // 7. Terminal middleware. Order matters: 404 must come after every route,
  //    and the error handler last of all.
  app.use(notFound)
  app.use(errorHandler as unknown as RequestHandler)

  return app
}
