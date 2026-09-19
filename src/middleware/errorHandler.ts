import type { ErrorRequestHandler, RequestHandler } from 'express'
import { ZodError } from 'zod'
import { Prisma } from '../generated/prisma/client.js'
import { AppError, isAppError } from '../lib/errors.js'
import { logger } from '../config/logger.js'
import { isProduction, isTest } from '../config/env.js'

/** Shape of the `http-errors` instances thrown by Express body parsers. */
interface HttpError extends Error {
  status?: number
  statusCode: number
  type?: string
  expose?: boolean
}

/**
 * Body-parser failures (413 too large, 400 malformed JSON) arrive as
 * `http-errors` instances carrying a `statusCode`. They must be recognised
 * before the generic branches, or they surface as a misleading 500.
 */
function isHttpError(err: unknown): err is HttpError {
  return (
    err instanceof Error &&
    typeof (err as Partial<HttpError>).statusCode === 'number' &&
    !isAppError(err)
  )
}

export const notFound: RequestHandler = (req, _res, next) => {
  next(new AppError(`Route ${req.method} ${req.originalUrl} not found`, 404, 'NOT_FOUND'))
}

interface ErrorBody {
  error: {
    code: string
    message: string
    requestId?: string
    details?: unknown
  }
}

/**
 * Translate any thrown value into a safe HTTP response.
 *
 * Must declare exactly four parameters: Express detects error middleware by
 * function arity, so dropping the unused `next` silently turns this into
 * ordinary middleware that never catches anything.
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const requestId = typeof req.id === 'string' ? req.id : undefined

  const { statusCode, body, logLevel } = toResponse(err, requestId)

  logger[logLevel](
    {
      err,
      requestId,
      method: req.method,
      url: req.originalUrl,
      statusCode,
    },
    'request failed',
  )

  if (res.headersSent) {
    // Response already started streaming; nothing safe left to do but abort.
    res.destroy()
    return
  }

  res.status(statusCode).json(body)
}

function toResponse(
  err: unknown,
  requestId: string | undefined,
): {
  statusCode: number
  body: ErrorBody
  logLevel: 'warn' | 'error'
} {
  // 0. Body-parser failures (413 payload too large, 400 malformed JSON). These
  //    arrive as http-errors instances and would otherwise fall through to the
  //    generic 500 branch below.
  if (isHttpError(err)) {
    const statusCode = err.statusCode
    const isTooLarge = err.type === 'entity.too.large'
    const isParseError = err.type === 'entity.parse.failed'
    const code = isTooLarge ? 'PAYLOAD_TOO_LARGE' : isParseError ? 'INVALID_JSON' : 'BAD_REQUEST'
    const message = isTooLarge
      ? 'Request body exceeds the size limit'
      : isParseError
        ? 'Request body is not valid JSON'
        : err.message

    return {
      statusCode,
      logLevel: statusCode >= 500 ? 'error' : 'warn',
      body: { error: { code, message, requestId } },
    }
  }

  // 1. Zod errors surfaced by the validation middleware.
  if (err instanceof ZodError) {
    return {
      statusCode: 422,
      logLevel: 'warn',
      body: {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          requestId,
          details: err.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
      },
    }
  }

  // 2. Known Prisma failures we can map to meaningful status codes without
  //    leaking column names or constraint identifiers.
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002':
        return {
          statusCode: 409,
          logLevel: 'warn',
          body: {
            error: { code: 'CONFLICT', message: 'Resource already exists', requestId },
          },
        }
      case 'P2025':
        return {
          statusCode: 404,
          logLevel: 'warn',
          body: { error: { code: 'NOT_FOUND', message: 'Resource not found', requestId } },
        }
      case 'P2003':
        return {
          statusCode: 409,
          logLevel: 'warn',
          body: {
            error: {
              code: 'FOREIGN_KEY_VIOLATION',
              message: 'Related resource does not exist',
              requestId,
            },
          },
        }
      default:
        break
    }
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    return {
      statusCode: 400,
      logLevel: 'warn',
      body: { error: { code: 'BAD_REQUEST', message: 'Invalid query', requestId } },
    }
  }

  if (err instanceof Prisma.PrismaClientInitializationError) {
    return {
      statusCode: 503,
      logLevel: 'error',
      body: {
        error: {
          code: 'DATABASE_UNAVAILABLE',
          message: 'Database is unavailable',
          requestId,
        },
      },
    }
  }

  // 3. Our own operational errors.
  if (isAppError(err)) {
    return {
      statusCode: err.statusCode,
      logLevel: err.statusCode >= 500 ? 'error' : 'warn',
      body: {
        error: {
          code: err.code,
          // 5xx messages can describe internals; withhold them in production.
          message: isProduction && err.statusCode >= 500 ? 'Internal server error' : err.message,
          requestId,
          ...(err.details === undefined ? {} : { details: err.details }),
        },
      },
    }
  }

  // 4. Unknown / programmer error. Never leak the message in production, and
  //    in tests let it through so a failure is debuggable.
  const message =
    err instanceof Error
      ? isProduction && !isTest
        ? 'Internal server error'
        : err.message
      : 'Internal server error'

  return {
    statusCode: 500,
    logLevel: 'error',
    body: { error: { code: 'INTERNAL_ERROR', message, requestId } },
  }
}
