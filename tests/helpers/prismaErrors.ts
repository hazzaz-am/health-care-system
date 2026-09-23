import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client'

/**
 * Builders for Prisma errors that match, field for field, what the real stack
 * produces.
 *
 * `@prisma/adapter-pg@7.10.0` throws a `DriverAdapterError` that keeps the
 * original Postgres failure on `cause`, and Prisma re-wraps that under
 * `meta.driverAdapterError`. The constraint therefore lives at
 * `meta.driverAdapterError.cause.constraint` — *not* at the `meta.target` older
 * engine-based Prisma exposed. These builders exist so that shape is asserted
 * in one place rather than guessed at per test.
 */

class DriverAdapterError extends Error {
  // Declared explicitly rather than as a constructor parameter property:
  // `erasableSyntaxOnly` bans that shorthand (see README).
  override readonly cause: Record<string, unknown>

  constructor(cause: Record<string, unknown>) {
    super(`Unique constraint failed on the constraint: \`${String(cause.constraint)}\``)
    this.name = 'DriverAdapterError'
    this.cause = cause
  }
}

export interface UniqueViolationOptions {
  /** The Postgres `detail` line, e.g. `Key (title)=(Cardiology) already exists.` */
  detail?: string
  /** The physical index name, which is what Postgres reports as `constraint`. */
  index?: string
  /** Only populated by the adapter when Postgres reported no constraint name. */
  fields?: string[]
  /** The physical table name. */
  table?: string
}

/**
 * The nested `meta` the adapter produces, so tests exercise the mapper against
 * a real shape rather than a hand-rolled approximation.
 */
export function uniqueViolationMeta(options: UniqueViolationOptions = {}): Record<string, unknown> {
  const { detail, index, fields, table } = options

  const constraint = fields !== undefined ? { fields } : index === undefined ? undefined : { index }

  const cause: Record<string, unknown> = {
    originalCode: '23505',
    originalMessage:
      detail ?? 'duplicate key value violates unique constraint "specialties_title_key"',
    kind: 'UniqueConstraintViolation',
    constraint,
  }
  if (table !== undefined) cause.table = table

  const meta: Record<string, unknown> = { driverAdapterError: new DriverAdapterError(cause) }
  if (table !== undefined) meta.table = table

  return meta
}

export function uniqueViolation(
  options: UniqueViolationOptions = {},
): PrismaClientKnownRequestError {
  return new PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '7.10.0',
    meta: uniqueViolationMeta(options),
  })
}

/** The violation the current schema would raise for a duplicate specialty title. */
export function duplicateSpecialtyTitle(title = 'Cardiology'): PrismaClientKnownRequestError {
  return uniqueViolation({
    detail: `Key (title)=(${title}) already exists.`,
    index: 'specialties_title_key',
    table: 'specialties',
  })
}

export function knownRequestError(
  code: string,
  message = 'Request failed',
): PrismaClientKnownRequestError {
  return new PrismaClientKnownRequestError(message, {
    code,
    clientVersion: '7.10.0',
    meta: {},
  })
}
