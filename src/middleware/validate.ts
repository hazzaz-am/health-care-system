import type { RequestHandler } from 'express'
import type { ZodType } from 'zod'
import { ValidationError } from '../lib/errors.js'

type Source = 'body' | 'query' | 'params'

/**
 * Validates and *replaces* a request property with the parsed result, so the
 * handler receives coerced, typed data (numbers as numbers, defaults applied)
 * rather than raw strings.
 *
 * Express 5 makes `req.query` a getter-only property, so it is redefined with
 * defineProperty instead of assigned.
 */
export function validate<T>(schema: ZodType<T>, source: Source = 'body'): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source])

    if (!result.success) {
      next(
        new ValidationError(
          'Request validation failed',
          result.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        ),
      )
      return
    }

    if (source === 'query') {
      Object.defineProperty(req, 'query', {
        value: result.data,
        writable: true,
        configurable: true,
        enumerable: true,
      })
    } else {
      req[source] = result.data as never
    }

    next()
  }
}
