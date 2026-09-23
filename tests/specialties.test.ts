import { afterEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { specialtyService } from '../src/modules/specialty/specialty.service.js'
import { duplicateSpecialtyTitle } from './helpers/prismaErrors.js'

const app = createApp({ disableRateLimit: true })

interface ErrorPayload {
  error: {
    code: string
    message: string
    requestId?: string
    details?: { fields?: string[] }
  }
}

/**
 * The unit tests in `errorHandler.test.ts` pin the mapping in isolation. These
 * assert the wiring around it: an error raised after the controller takes over
 * reaches the terminal handler through Express 5's automatic promise-rejection
 * forwarding, with no try/catch in between.
 *
 * The service is stubbed rather than the repository, because `createSpecialty`
 * runs a `findByTitle` uniqueness pre-check first — and that pre-check is the
 * one thing a duplicate title can slip past. Two concurrent requests can both
 * see `null` and race to insert, leaving the database's unique index as the
 * only thing that stops the second one and raising `P2002` from the insert
 * itself. That is an error shape no service-level check ever produces.
 *
 * These tests need no database as a result, which is why they can run in CI
 * where Postgres is absent.
 */
describe('specialties API: unique violations surface as a field-named 409', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  function stubCreateToThrow(error: unknown): void {
    vi.spyOn(specialtyService, 'create').mockImplementation(() => {
      throw error
    })
  }

  it('returns 409 naming the conflicting field when the insert hits the unique index', async () => {
    stubCreateToThrow(duplicateSpecialtyTitle())

    const res = await request(app).post('/api/v1/specialties').send({ title: 'Cardiology' })
    const body = res.body as ErrorPayload

    expect(res.status).toBe(409)
    expect(body.error.code).toBe('CONFLICT')
    expect(body.error.message).toBe('A record with this title already exists')
    expect(body.error.details).toEqual({ fields: ['title'] })
    expect(body.error.requestId).toBeTruthy()
  })

  it('does not leak the constraint identifier or the submitted value', async () => {
    const secret = 'Internal-Only-Title'
    stubCreateToThrow(duplicateSpecialtyTitle(secret))

    const res = await request(app).post('/api/v1/specialties').send({ title: secret })
    const serialized = JSON.stringify(res.body)

    expect(res.status).toBe(409)
    expect(serialized).not.toContain('specialties_title_key')
    expect(serialized).not.toContain(secret)
  })

  it('reports an unexpected failure as a generic 500', async () => {
    stubCreateToThrow(new Error('connection terminated unexpectedly'))

    const res = await request(app).post('/api/v1/specialties').send({ title: 'Cardiology' })
    const body = res.body as ErrorPayload

    expect(res.status).toBe(500)
    expect(body.error.code).toBe('INTERNAL_ERROR')
  })

  it('still rejects an invalid payload before the service is called', async () => {
    const create = vi.spyOn(specialtyService, 'create')

    const res = await request(app).post('/api/v1/specialties').send({ title: '' })
    const body = res.body as ErrorPayload

    expect(res.status).toBe(422)
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(create).not.toHaveBeenCalled()
  })
})
