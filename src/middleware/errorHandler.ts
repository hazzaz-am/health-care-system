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

/**
 * Postgres reports the offending key columns in the `detail` field, e.g.
 * `Key (title)=(Cardiology) already exists.` Capturing only the names left of
 * `)=` means the conflicting *value* is never read.
 *
 * Not every violation carries this: the driver adapter parses `detail` to build
 * `constraint.index` and then drops it, so a uniquely-indexed column arrives
 * with no detail line at all. That is why `indexColumn` below exists.
 */
const KEY_DETAIL = /Key \(([^)]+)\)=/

/**
 * Prisma names a single-column unique index `<table>_<column>_key`, so the
 * column is whatever sits between the first underscore and the `_key` suffix.
 * Anchored on both ends to avoid matching an unrelated string that merely
 * contains `_key`.
 */
const NAMED_KEY_INDEX = /^[^_]+_(.+)_key$/

/** A bare SQL identifier. Rejects schema-qualified names and anything punctuated. */
const SAFE_COLUMN = /^[A-Za-z_][A-Za-z0-9_]*$/

/** A plain object we can safely read properties from. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * Split a comma-separated column list (Postgres's `detail` shape) and keep only
 * bare SQL identifiers.
 */
function splitColumns(value: string): string[] {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter((part) => SAFE_COLUMN.test(part))
}

/**
 * Recover the column from a named single-column unique index, inverting
 * Prisma's `<table>_<column>_key` naming.
 *
 * `undefined` when the name does not fit that shape, which is the honest answer
 * for a hand-written multi-column index: `a_b_c_key` does not say where the
 * table ends and the column starts, so guessing could name a nonexistent field.
 */
function indexColumn(index: unknown): string | undefined {
  if (typeof index !== 'string') return undefined
  const column = NAMED_KEY_INDEX.exec(index)?.[1]
  return column !== undefined && SAFE_COLUMN.test(column) ? column : undefined
}

/**
 * The columns that collided in a Prisma `P2002`, or `[]` to stay generic.
 *
 * Exported so it can be tested against each metadata shape directly; the
 * `P2002` branch below is its only production caller.
 *
 * The constraint lives at `meta.driverAdapterError.cause` — *not* at the
 * `meta.target` that older engine-based Prisma exposed. Three sources are read,
 * in order of what they can actually be trusted to say:
 *
 * 1. Postgres's `detail` line, when present. It is the only source that names
 *    every column of a composite key.
 * 2. `constraint.index`, the physical index name, which is the *only* source a
 *    named-index violation has. It names one column, inferred from the name.
 * 3. `constraint.fields`, an array the adapter fills in only when Postgres
 *    reported no constraint name. In practice this is rare, because a unique
 *    index almost always has a name — it is kept because the cost is two lines.
 *
 * These are **database column names**, not Prisma model field names. The two
 * coincide today because the schema declares no `@map`. Add
 * `@map("specialty_title")` and source 2 yields `specialty_title`, while source
 * 1 would still yield the true column — so the result is a column name either
 * way, and inverting it would need the generated client's runtime data model.
 */
export function p2002Fields(meta: Record<string, unknown> | undefined): string[] {
  const adapterError = meta?.driverAdapterError
  if (!isRecord(adapterError)) return []

  const cause = adapterError.cause
  if (!isRecord(cause)) return []

  const fromDetail =
    typeof cause.originalMessage === 'string'
      ? KEY_DETAIL.exec(cause.originalMessage)?.[1]
      : undefined
  if (fromDetail !== undefined) {
    const columns = splitColumns(fromDetail)
    if (columns.length > 0) return [...new Set(columns)]
  }

  const constraint = isRecord(cause.constraint) ? cause.constraint : undefined

  const fromIndex = indexColumn(constraint?.index)
  if (fromIndex !== undefined) return [fromIndex]

  const fields = constraint?.fields
  if (!Array.isArray(fields)) return []

  const columns = fields.flatMap((field) => (typeof field === 'string' ? splitColumns(field) : []))
  return [...new Set(columns)]
}

export function toResponse(
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

  // 2. Known Prisma failures we can map to meaningful status codes. The field
  //    names below come from Postgres's own error detail; constraint
  //    identifiers and offending values are never forwarded. See
  //    `p2002Fields` for what is and is not safe to expose.
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002': {
        const fields = p2002Fields(err.meta)
        return {
          statusCode: 409,
          logLevel: 'warn',
          body: {
            error: {
              code: 'CONFLICT',
              // Naming the field lets a client attach the error to the right
              // input — which matters because this branch also catches the
              // create/update races a service's own uniqueness pre-check cannot.
              message:
                fields.length > 0
                  ? `A record with this ${fields.join(', ')} already exists`
                  : 'Resource already exists',
              requestId,
              ...(fields.length === 0 ? {} : { details: { fields } }),
            },
          },
        }
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
