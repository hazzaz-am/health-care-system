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

describe('p2002Fields: resolving fields from Prisma metadata', () => {
  it('reads the column names Postgres reported', () => {
    expect(
      p2002Fields(uniqueViolationMeta({ detail: 'Key (title)=(Cardiology) exists.' })),
    ).toEqual(['title'])
  })

  it('reads every column of a composite key from the detail line', () => {
    // `title` and `createdAt` are both real Specialty fields, so a composite
    // unique index over them is representable.
    expect(
      p2002Fields(
        uniqueViolationMeta({ detail: 'Key (title, createdAt)=(p1, t1) already exists.' }),
      ),
    ).toEqual(['title', 'createdAt'])
  })

  it('ignores the conflicting value, capturing only names left of )=', () => {
    const meta = uniqueViolationMeta({
      detail: 'Key (title)=(Cardiology) already exists.',
    })

    expect(p2002Fields(meta)).toEqual(['title'])
  })

  it('never reads the value, even when it resembles a field name', () => {
    const meta = uniqueViolationMeta({
      detail: 'Key (title)=(createdAt) already exists.',
    })

    // `createdAt` is a real field, but it appears as the *value*, so it must
    // not be picked up.
    expect(p2002Fields(meta)).toEqual(['title'])
  })

  it('recovers the field from the index name when there is no detail line', () => {
    // The shape a real violation of the current schema has: the adapter drops
    // Postgres's detail line after using it to build `constraint.index`, so the
    // index name is the only source left. Verified against a live database in
    // `specialties.db.test.ts`.
    expect(
      p2002Fields(uniqueViolationMeta({ detail: 'plain', index: 'specialties_title_key' })),
    ).toEqual(['title'])
  })

  it('splits a composite index name back into its real fields', () => {
    // Caveat this fixes: `patientId_scheduledAt` is two names, not one. Without
    // splitting, the client would be told to look for a field that cannot exist.
    expect(
      p2002Fields(
        uniqueViolationMeta({ detail: 'plain', index: 'specialties_title_createdAt_key' }),
      ),
    ).toEqual(['title', 'createdAt'])
  })

  it('drops a candidate that is not a field of the model', () => {
    // Namely the failure mode if the mapping is ever wrong: no invented field.
    expect(
      p2002Fields(uniqueViolationMeta({ detail: 'plain', index: 'specialties_nonsense_key' })),
    ).toEqual([])
  })

  it('does not echo a mapped column name the client has never seen', () => {
    // With `@map("specialty_title")` on `title`, the index becomes
    // `specialties_specialty_title_key`. `specialty_title` is not a field name,
    // so nothing is claimed and the caller stays generic — better than naming a
    // field the client cannot match against its input.
    expect(
      p2002Fields(
        uniqueViolationMeta({ detail: 'plain', index: 'specialties_specialty_title_key' }),
      ),
    ).toEqual([])
  })

  it('never returns the raw index name', () => {
    const meta = uniqueViolationMeta({ detail: 'plain', index: 'specialties_title_key' })
    expect(JSON.stringify(p2002Fields(meta))).not.toContain('specialties_title_key')
  })

  it('falls back to constraint.fields when there is no detail or index', () => {
    expect(p2002Fields(uniqueViolationMeta({ detail: 'plain', fields: ['title'] }))).toEqual([
      'title',
    ])
  })

  it('prefers the detail line over the index', () => {
    const meta = uniqueViolationMeta({
      detail: 'Key (description)=(x) already exists.',
      index: 'specialties_title_key',
    })

    expect(p2002Fields(meta)).toEqual(['description'])
  })

  it('drops candidates that are not bare identifiers', () => {
    const meta = uniqueViolationMeta({
      detail: 'Key (title, "quoted", schema.title)=(a, b, c) already exists.',
    })

    // `"quoted"` and `schema.title` are not bare identifiers, so they never
    // become candidates. `title` is a real field and survives.
    expect(p2002Fields(meta)).toEqual(['title'])
  })

  it('returns no duplicates when a field repeats', () => {
    expect(
      p2002Fields(uniqueViolationMeta({ detail: 'Key (title, title, title)=(1, 2, 3) exists.' })),
    ).toEqual(['title'])
  })

  it('handles missing, empty and malformed metadata without throwing', () => {
    expect(p2002Fields(undefined)).toEqual([])
    expect(p2002Fields({})).toEqual([])
    expect(p2002Fields({ driverAdapterError: null })).toEqual([])
    expect(p2002Fields({ driverAdapterError: { cause: 'not an object' } })).toEqual([])
    expect(p2002Fields({ driverAdapterError: { cause: {} } })).toEqual([])
    expect(p2002Fields(uniqueViolationMeta({ detail: 'no key detail at all' }))).toEqual([])
  })

  it('stays generic when the model is unknown, rather than trusting the name', () => {
    // Without a model there is no field list to validate against, so no claim
    // is made. This is the guard that keeps a raw index name from escaping.
    expect(
      p2002Fields(
        uniqueViolationMeta({ detail: 'plain', index: 'specialties_title_key', modelName: 'Nope' }),
      ),
    ).toEqual([])

    // And when the key is absent altogether.
    const meta = uniqueViolationMeta({ detail: 'plain', index: 'specialties_title_key' })
    delete meta.modelName
    expect(p2002Fields(meta)).toEqual([])
  })

  it('handles a string element inside constraint.fields, and ignores non-strings', () => {
    const meta = uniqueViolationMeta({ detail: 'plain' })
    const cause = Reflect.get(Reflect.get(meta, 'driverAdapterError') as object, 'cause') as Record<
      string,
      unknown
    >
    cause.constraint = { fields: ['title, description', 42, 'icon'] }

    expect(p2002Fields(meta)).toEqual(['title', 'description', 'icon'])
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

  it('lists every field of a composite key', () => {
    const { body } = toResponse(
      uniqueViolation({ detail: 'Key (title, createdAt)=(t, 2026-01-01) already exists.' }),
      'req-2',
    )

    expect(body.error.message).toBe('A record with this title, createdAt already exists')
    expect(body.error.details).toEqual({ fields: ['title', 'createdAt'] })
  })

  it('never leaks the conflicting value into the message or details', () => {
    const secret = 'grace.hopper@example.com'
    const { body } = toResponse(
      uniqueViolation({ detail: `Key (description)=(${secret}) already exists.` }),
      'req-3',
    )

    expect(body.error.details).toEqual({ fields: ['description'] })
    expect(JSON.stringify(body)).not.toContain(secret)
  })

  it('falls back to the adapter-parsed fields when Postgres sent no detail', () => {
    const { body } = toResponse(
      uniqueViolation({ detail: 'duplicate key value', fields: ['title'] }),
      'req-4',
    )

    expect(body.error.details).toEqual({ fields: ['title'] })
  })

  it('names every field of a composite index, split from the index name', () => {
    const { body } = toResponse(
      uniqueViolation({ detail: 'duplicate key value', index: 'specialties_title_createdAt_key' }),
      'req-4b',
    )

    expect(body.error.message).toBe('A record with this title, createdAt already exists')
    expect(body.error.details).toEqual({ fields: ['title', 'createdAt'] })
  })

  it('names the field while never echoing the raw index name', () => {
    // The index is the only source here, and it yields the field. What must not
    // happen is the index name itself reaching the client: it embeds the table
    // name and is not something the client can match against an input.
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
