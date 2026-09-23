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
 * `constraint.index` and then drops it, so a uniquely-indexed column usually
 * arrives with no detail line at all — which is why the index name below is the
 * source that matters in practice.
 */
const KEY_DETAIL = /Key \(([^)]+)\)=/

/**
 * Prisma names a unique index `<table>_<columns>_key`, so the part between the
 * first underscore and the `_key` suffix is the column list — one name, or
 * several joined by underscores. Anchored on both ends so an unrelated string
 * that merely contains `_key` is not mistaken for one of ours.
 */
const NAMED_KEY_INDEX = /^[^_]+_(.+)_key$/

/** A bare SQL identifier. Rejects schema-qualified names and anything punctuated. */
const SAFE_COLUMN = /^[A-Za-z_][A-Za-z0-9_]*$/

/** A plain object we can safely read properties from. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * Split a joined column list back into model fields by consuming it left to
 * right, longest field name first.
 *
 * Longest-first is what makes this deterministic when one field name is a
 * prefix of another (`id` and `identifier`, or `title` and `titleShort`):
 * trying the longer name first avoids a shorter match that would strand the
 * remainder. Backtracking still runs, so an early guess that cannot consume the
 * whole string is abandoned rather than returned.
 *
 * `undefined` when no combination of fields consumes the input exactly, which
 * is how a name that is not a field list at all gets rejected.
 */
function segment(value: string, fields: readonly string[]): string[] | undefined {
  if (value === '') return []
  for (const field of [...fields].sort((a, b) => b.length - a.length)) {
    if (value === field) return [field]
    if (!value.startsWith(`${field}_`)) continue
    const rest = segment(value.slice(field.length + 1), fields)
    if (rest !== undefined) return [field, ...rest]
  }
  return undefined
}

/**
 * Interpret one candidate as the set of fields it names.
 *
 * Returns `[]` when the candidate is not a field of the model, in any spelling —
 * which is what keeps an index name out of the response.
 */
function resolveCandidate(candidate: string, fields: readonly string[]): string[] {
  if (fields.includes(candidate)) return [candidate]
  return segment(candidate, fields) ?? []
}

/**
 * The scalar field names of a Prisma model, read from the generated client.
 *
 * Sourced from Prisma's field enum rather than a hand-written list, so it
 * cannot drift from `schema.prisma`. Indexing the namespace by computed name is
 * what keeps this generic instead of a `switch` per model.
 */
function modelFields(modelName: unknown): readonly string[] {
  if (typeof modelName !== 'string') return []
  const fieldEnum = Prisma[`${modelName}ScalarFieldEnum` as keyof typeof Prisma]
  if (!isRecord(fieldEnum)) return []
  return Object.values(fieldEnum).filter((field): field is string => typeof field === 'string')
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
 * The columns that collided in a Prisma `P2002`, or `[]` to stay generic.
 *
 * Exported so it can be tested against each metadata shape directly; the
 * `P2002` branch below is its only production caller.
 *
 * The constraint lives at `meta.driverAdapterError.cause` — *not* at the
 * `meta.target` that older engine-based Prisma exposed. Three sources are read,
 * in order of what they can actually be trusted to say:
 *
 * 1. Postgres's `detail` line (`Key (title)=(Cardiology)`), which names columns
 *    directly but is discarded by the driver adapter on a named-index
 *    violation — so in practice this is the rare path.
 * 2. `constraint.fields`, an array the adapter fills in only when Postgres
 *    reported no constraint name.
 * 3. `constraint.index`, the physical index name, which is the only source a
 *    named-index violation has.
 *
 * Every candidate from any source is resolved through the model's real fields
 * before being returned, so the result is always a set of field names the
 * client can act on — never a raw column or index name.
 */
export function p2002Fields(meta: Record<string, unknown> | undefined): string[] {
  const adapterError = meta?.driverAdapterError
  if (!isRecord(adapterError)) return []

  const cause = adapterError.cause
  if (!isRecord(cause)) return []

  const fields = modelFields(meta?.modelName)
  if (fields.length === 0) return []

  const detail =
    typeof cause.originalMessage === 'string'
      ? KEY_DETAIL.exec(cause.originalMessage)?.[1]
      : undefined

  const constraint = isRecord(cause.constraint) ? cause.constraint : undefined
  const reported = constraint?.fields
  const index =
    typeof constraint?.index === 'string' && NAMED_KEY_INDEX.test(constraint.index)
      ? [constraint.index.slice(constraint.index.indexOf('_') + 1, -'_key'.length)]
      : []

  // Ordered by trust. Each source is resolved as a whole, because a composite
  // key is only meaningful across all of its columns plus any extras a
  // lower-trust source may add — a partial answer would under-name the conflict.
  const sources: string[][] = [
    detail === undefined ? [] : splitColumns(detail),
    Array.isArray(reported)
      ? reported.flatMap((field) => (typeof field === 'string' ? splitColumns(field) : []))
      : [],
    index,
  ]

  for (const source of sources) {
    const names = source.flatMap((candidate) => resolveCandidate(candidate, fields))
    if (names.length > 0) return [...new Set(names)]
  }

  return []
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
