/**
 * Application error hierarchy.
 *
 * `isOperational` separates expected failures (bad input, missing record, a
 * dependency being down) from programmer errors (a TypeError, a failed
 * assertion). The error handler uses it to decide whether the message is safe
 * to expose to the caller or should be replaced with a generic one.
 */
export class AppError extends Error {
  readonly statusCode: number
  readonly code: string
  readonly isOperational: boolean
  readonly details: unknown

  constructor(
    message: string,
    statusCode = 500,
    code = 'INTERNAL_ERROR',
    options: { isOperational?: boolean; details?: unknown; cause?: unknown } = {},
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause })
    this.name = new.target.name
    this.statusCode = statusCode
    this.code = code
    this.isOperational = options.isOperational ?? true
    this.details = options.details
    Error.captureStackTrace(this, new.target)
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad request', details?: unknown) {
    super(message, 400, 'BAD_REQUEST', { details })
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'UNAUTHORIZED')
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(message, 403, 'FORBIDDEN')
  }
}

export class NotFoundError extends AppError {
  constructor(what = 'Resource') {
    super(`${what} not found`, 404, 'NOT_FOUND')
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource already exists', details?: unknown) {
    super(message, 409, 'CONFLICT', { details })
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details?: unknown) {
    super(message, 422, 'VALIDATION_ERROR', { details })
  }
}

export interface FieldIssue {
  path: string
  message: string
}

export class ServiceUnavailableError extends AppError {
  constructor(message = 'Service temporarily unavailable', details?: unknown) {
    super(message, 503, 'SERVICE_UNAVAILABLE', { details })
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError
}
