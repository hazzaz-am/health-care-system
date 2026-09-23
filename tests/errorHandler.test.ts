import { describe, expect, it } from 'vitest'
import { BadRequestError, ConflictError, ServiceUnavailableError } from '../src/lib/errors.js'
import { p2002Fields, toResponse } from '../src/middleware/errorHandler.js'
import {
  knownRequestError,
  duplicateSpecialtyTitle,
  uniqueViolation,
  uniqueViolationMeta,
} from './helpers/prismaErrors.js'

/**
 * Unit tests for the terminal error mapper.
 *
 * Prisma errors are constructed through `tests/helpers/prismaErrors.ts` instead
 * of being provoked through the database: that keeps these assertions
 * deterministic and runnable without a live Postgres, while pinning the exact
 * metadata shape the driver adapter produces. See that helper for why the
 * constraint is not at `meta.target`.
 */

describe('p2002Fields: reading columns out of Prisma metadata', () => {
  it('reads the column names Postgres reported', () => {
    expect(
      p2002Fields(uniqueViolationMeta({ detail: 'Key (title)=(Cardiology) exists.' })),
    ).toEqual(['title'])
  })

  it('reads every column of a composite index', () => {
    expect(
      p2002Fields(
        uniqueViolationMeta({ detail: 'Key (patientId, scheduledAt)=(p1, t1) already exists.' }),
      ),
    ).toEqual(['patientId', 'scheduledAt'])
  })

  it('ignores the conflicting value, capturing only names left of )=', () => {
    const meta = uniqueViolationMeta({
      detail: 'Key (email)=(grace.hopper@example.com) already exists.',
    })

    expect(p2002Fields(meta)).toEqual(['email'])
    expect(JSON.stringify(p2002Fields(meta))).not.toContain('grace.hopper')
  })

  it('recovers the column from the index name when there is no detail line', () => {
    // This is the shape a real violation of the current schema has: the adapter
    // drops Postgres's detail line after using it to build `constraint.index`,
    // so the index name is the only source left. Verified against a live
    // database in `specialties.db.test.ts`.
    expect(
      p2002Fields(uniqueViolationMeta({ detail: 'plain', index: 'specialties_title_key' })),
    ).toEqual(['title'])
  })

  it('recovers a column whose own name contains an underscore', () => {
    expect(
      p2002Fields(uniqueViolationMeta({ detail: 'plain', index: 'patients_first_name_key' })),
    ).toEqual(['first_name'])
  })

  it('cannot split a multi-column index name, and says so by joining it', () => {
    // Prisma names a multi-column unique index `<table>_<col1>_<col2>_key`, but
    // the name alone does not mark where the table stops and the columns begin,
    // and a column may legitimately contain an underscore (`first_name`). The
    // joined value is returned rather than guessed at. The current schema has
    // no composite unique index, and a real one is covered by the detail-line
    // case handled in `specialties.db.test.ts`.
    expect(
      p2002Fields(
        uniqueViolationMeta({ detail: 'plain', index: 'appointment_patientId_scheduledAt_key' }),
      ),
    ).toEqual(['patientId_scheduledAt'])
  })

  it('never returns the raw index name', () => {
    const meta = uniqueViolationMeta({ detail: 'plain', index: 'specialties_title_key' })
    expect(JSON.stringify(p2002Fields(meta))).not.toContain('specialties_title_key')
  })

  it('falls back to constraint.fields when there is no index either', () => {
    expect(p2002Fields(uniqueViolationMeta({ detail: 'plain', fields: ['email'] }))).toEqual([
      'email',
    ])
  })

  it('prefers the detail line, which can name every column of a composite key', () => {
    const meta = uniqueViolationMeta({
      detail: 'Key (patientId, scheduledAt)=(p1, t1) already exists.',
      index: 'appointment_patientId_scheduledAt_key',
    })

    expect(p2002Fields(meta)).toEqual(['patientId', 'scheduledAt'])
  })

  it('drops entries that are not plain identifiers', () => {
    const meta = uniqueViolationMeta({
      detail: 'Key (title, "quoted", schema.col, ok_2)=(a, b, c, d) already exists.',
    })

    expect(p2002Fields(meta)).toEqual(['title', 'ok_2'])
  })

  it('returns no duplicates when a column repeats', () => {
    expect(p2002Fields(uniqueViolationMeta({ detail: 'Key (a, a, a)=(1, 2, 3) exists.' }))).toEqual(
      ['a'],
    )
  })

  it('handles missing, empty and malformed metadata without throwing', () => {
    expect(p2002Fields(undefined)).toEqual([])
    expect(p2002Fields({})).toEqual([])
    expect(p2002Fields({ driverAdapterError: null })).toEqual([])
    expect(p2002Fields({ driverAdapterError: { cause: 'not an object' } })).toEqual([])
    expect(p2002Fields({ driverAdapterError: { cause: {} } })).toEqual([])
    expect(p2002Fields(uniqueViolationMeta({ detail: 'no key detail at all' }))).toEqual([])
  })

  it('handles a string element inside constraint.fields, and ignores non-strings', () => {
    const meta = uniqueViolationMeta({ detail: 'plain' })
    const cause = Reflect.get(Reflect.get(meta, 'driverAdapterError') as object, 'cause') as Record<
      string,
      unknown
    >
    cause.constraint = { fields: ['title, email', 42, 'id'] }

    expect(p2002Fields(meta)).toEqual(['title', 'email', 'id'])
  })
})

describe('error mapper: unique constraint violations', () => {
  it('names the column Postgres reported when it names one', () => {
    const { statusCode, body } = toResponse(duplicateSpecialtyTitle(), 'req-1')

    expect(statusCode).toBe(409)
    expect(body.error.code).toBe('CONFLICT')
    expect(body.error.message).toBe('A record with this title already exists')
    expect(body.error.details).toEqual({ fields: ['title'] })
    expect(body.error.requestId).toBe('req-1')
  })

  it('lists every column of a composite index', () => {
    const { body } = toResponse(
      uniqueViolation({ detail: 'Key (patientId, scheduledAt)=(p1, 2026-01-01) already exists.' }),
      'req-2',
    )

    expect(body.error.message).toBe('A record with this patientId, scheduledAt already exists')
    expect(body.error.details).toEqual({ fields: ['patientId', 'scheduledAt'] })
  })

  it('never leaks the conflicting value into the message or details', () => {
    const secret = 'grace.hopper@example.com'
    const { body } = toResponse(
      uniqueViolation({ detail: `Key (email)=(${secret}) already exists.` }),
      'req-3',
    )

    expect(body.error.details).toEqual({ fields: ['email'] })
    expect(JSON.stringify(body)).not.toContain(secret)
  })

  it('falls back to the adapter-parsed fields when Postgres sent no detail', () => {
    const { body } = toResponse(
      uniqueViolation({ detail: 'duplicate key value', fields: ['email'] }),
      'req-4',
    )

    expect(body.error.details).toEqual({ fields: ['email'] })
  })

  it('names the column while never echoing the raw index name', () => {
    // The index is the only source here, and it yields the column. What must
    // not happen is the index name itself reaching the client: it embeds the
    // table name and would be wrong after an `@map` rename.
    const { statusCode, body } = toResponse(
      uniqueViolation({ detail: 'duplicate key value', index: 'specialties_title_key' }),
      'req-5',
    )

    expect(statusCode).toBe(409)
    expect(body.error.message).toBe('A record with this title already exists')
    expect(body.error.details).toEqual({ fields: ['title'] })
    expect(JSON.stringify(body)).not.toContain('specialties_title_key')
  })

  it('stays generic when the metadata carries no usable constraint at all', () => {
    const { statusCode, body } = toResponse(knownRequestError('P2002'), 'req-6')

    expect(statusCode).toBe(409)
    expect(body.error.code).toBe('CONFLICT')
    expect(body.error.message).toBe('Resource already exists')
  })

  it('stays generic when the index name carries no identifiable column', () => {
    const { body } = toResponse(
      uniqueViolation({ detail: 'duplicate key value', index: 'not_a_prisma_key_name' }),
      'req-6b',
    )

    expect(body.error.message).toBe('Resource already exists')
    expect(body.error.details).toBeUndefined()
  })
})

describe('error mapper: other mapped failures', () => {
  it('maps P2025 to 404', () => {
    const { statusCode, body } = toResponse(knownRequestError('P2025', 'Record not found'), 'req-7')
    expect(statusCode).toBe(404)
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('maps P2003 to 409 with a distinct code', () => {
    const { statusCode, body } = toResponse(
      knownRequestError('P2003', 'Foreign key constraint violated'),
      'req-8',
    )
    expect(statusCode).toBe(409)
    expect(body.error.code).toBe('FOREIGN_KEY_VIOLATION')
  })

  it('maps an unrecognised Prisma code to a generic 500', () => {
    const { statusCode, logLevel, body } = toResponse(
      knownRequestError('P2024', 'Something else went wrong'),
      'req-9',
    )

    expect(statusCode).toBe(500)
    expect(logLevel).toBe('error')
    expect(body.error.code).toBe('INTERNAL_ERROR')
  })
})

describe('error mapper: application errors', () => {
  it('uses the status and code from an AppError subclass', () => {
    const { statusCode, logLevel, body } = toResponse(new ConflictError('Already taken'), 'req-a')

    expect(statusCode).toBe(409)
    expect(logLevel).toBe('warn')
    expect(body.error.code).toBe('CONFLICT')
    expect(body.error.message).toBe('Already taken')
  })

  it('passes AppError details through untouched', () => {
    const details = [{ path: 'title', message: 'Required' }]
    const { body } = toResponse(new BadRequestError('Nope', details), 'req-b')
    expect(body.error.details).toEqual(details)
  })

  it('logs a 5xx AppError at error level', () => {
    const { statusCode, logLevel } = toResponse(new ServiceUnavailableError(), 'req-c')
    expect(statusCode).toBe(503)
    expect(logLevel).toBe('error')
  })

  it('omits undefined requestId and details from the serialized wire body', () => {
    const { body } = toResponse(new ConflictError(), undefined)

    // The keys are assigned unconditionally, so they exist on the object but
    // JSON.stringify drops undefined values. What matters is the wire shape,
    // and it must not carry `requestId: undefined` or a null `details` key.
    expect(JSON.parse(JSON.stringify(body))).toEqual({
      error: { code: 'CONFLICT', message: 'Resource already exists' },
    })
  })
})

describe('error mapper: unknown errors', () => {
  it('reports a thrown non-Error as a generic 500', () => {
    const { statusCode, body } = toResponse('just a string', 'req-d')

    expect(statusCode).toBe(500)
    expect(body.error.code).toBe('INTERNAL_ERROR')
    expect(body.error.message).toBe('Internal server error')
  })

  it('maps a plain Error to 500 and keeps the message outside production', () => {
    // NODE_ENV is `test` under vitest, and the mapper deliberately keeps the
    // real message visible there so a failing test is debuggable.
    const { statusCode, logLevel, body } = toResponse(new Error('boom'), 'req-e')

    expect(statusCode).toBe(500)
    expect(logLevel).toBe('error')
    expect(body.error.message).toBe('boom')
  })
})
