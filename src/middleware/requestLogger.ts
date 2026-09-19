import { randomUUID } from 'node:crypto'
import { pinoHttp } from 'pino-http'
import type { RequestHandler } from 'express'
import { logger } from '../config/logger.js'
import { requestContext } from '../lib/asyncContext.js'
import { isTest } from '../config/env.js'

/**
 * Request logging + correlation id.
 *
 * pino-http owns request-id generation (see `genReqId`), so there is no
 * separate requestId middleware: one source of truth for `req.id`, and it is
 * attached to every log line automatically. The id is echoed back in the
 * `x-request-id` response header so a client can quote it in a bug report.
 *
 * Wrapped so that downstream middleware runs inside the AsyncLocalStorage
 * context, which is what makes `getRequestId()` work in the service layer.
 */
const httpLogger = pinoHttp({
  logger,
  genReqId: (req, res) => {
    const incoming = req.headers['x-request-id']
    const id = typeof incoming === 'string' && incoming.length > 0 ? incoming : randomUUID()
    res.setHeader('x-request-id', id)
    return id
  },
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return 'error'
    if (res.statusCode >= 400) return 'warn'
    return 'info'
  },
  // Successful health probes are noise at info level.
  autoLogging: {
    ignore: (req) =>
      isTest || (req.url !== undefined && /^\/healthz/.test(req.url.split('?')[0] ?? '')),
  },
  customSuccessMessage: (req, res) => `${req.method ?? '?'} ${req.url ?? '?'} ${res.statusCode}`,
}) as unknown as RequestHandler

export const requestLogger: RequestHandler = (req, res, next) => {
  httpLogger(req, res, (err: unknown) => {
    if (err) {
      next(err)
      return
    }
    // `genReqId` above only ever returns a string, but pino-http types `req.id`
    // as `number | string | object`, so narrow before using it.
    const id = typeof req.id === 'string' ? req.id : ''
    // Call `next()` exactly once: a middleware that calls it twice makes the
    // router re-dispatch with a restored `req.url`, and the request falls
    // through to the 404 handler even though a route already matched.
    requestContext.run({ requestId: id }, () => {
      next()
    })
  })
}
