import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'

const app = createApp({ disableRateLimit: true })
const auth = { Authorization: 'Bearer test-token' }

interface ErrorPayload {
  error: { code: string; message: string; details?: unknown }
}

describe('patients API', () => {
  it('lists patients with pagination metadata', async () => {
    const res = await request(app).get('/api/v1/patients?limit=10&offset=0').set(auth)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.items)).toBe(true)
    expect(res.body).toMatchObject({ limit: 10, offset: 0 })
    expect(typeof res.body.total).toBe('number')
  })

  it('coerces and validates query parameters', async () => {
    const invalid = await request(app).get('/api/v1/patients?limit=500').set(auth)
    expect(invalid.status).toBe(422)
    expect((invalid.body as ErrorPayload).error.code).toBe('VALIDATION_ERROR')

    const nonNumeric = await request(app).get('/api/v1/patients?offset=abc').set(auth)
    expect(nonNumeric.status).toBe(422)
  })

  it('creates a patient and returns its location', async () => {
    const email = `new-${randomUUID()}@example.com`
    const res = await request(app).post('/api/v1/patients').set(auth).send({
      firstName: 'Grace',
      lastName: 'Hopper',
      email,
      dateOfBirth: '1990-04-02',
    })

    expect(res.status).toBe(201)
    expect(res.headers.location).toMatch(/^\/api\/v1\/patients\//)
    expect(res.body.data).toMatchObject({ email, firstName: 'Grace' })
    expect(res.body.data.id).toBeTypeOf('string')
  })

  it('rejects an invalid payload with per-field details', async () => {
    const res = await request(app).post('/api/v1/patients').set(auth).send({
      firstName: '',
      email: 'not-an-email',
      dateOfBirth: '02-04-1990',
    })
    const body = res.body as ErrorPayload

    expect(res.status).toBe(422)
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(Array.isArray(body.error.details)).toBe(true)
    expect((body.error.details as unknown[]).length).toBeGreaterThanOrEqual(3)
  })

  it('refuses a duplicate email with 409 rather than creating a second record', async () => {
    const email = `dupe-${randomUUID()}@example.com`
    const payload = {
      firstName: 'Alan',
      lastName: 'Turing',
      email,
      dateOfBirth: '1912-06-23',
    }

    const first = await request(app).post('/api/v1/patients').set(auth).send(payload)
    expect(first.status).toBe(201)

    const second = await request(app).post('/api/v1/patients').set(auth).send(payload)
    expect(second.status).toBe(409)
    expect((second.body as ErrorPayload).error.code).toBe('CONFLICT')
  })

  it('rejects a non-UUID id at the parameter boundary', async () => {
    const res = await request(app).get('/api/v1/patients/not-a-uuid').set(auth)

    expect(res.status).toBe(422)
    expect((res.body as ErrorPayload).error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 404 for a well-formed but unknown id', async () => {
    const res = await request(app).get(`/api/v1/patients/${randomUUID()}`).set(auth)

    expect(res.status).toBe(404)
    expect((res.body as ErrorPayload).error.code).toBe('NOT_FOUND')
  })

  it('updates a patient and then deletes it', async () => {
    const created = await request(app)
      .post('/api/v1/patients')
      .set(auth)
      .send({
        firstName: 'Katherine',
        lastName: 'Johnson',
        email: `update-${randomUUID()}@example.com`,
        dateOfBirth: '1918-08-26',
      })

    const id = created.body.data.id as string

    const patched = await request(app)
      .patch(`/api/v1/patients/${id}`)
      .set(auth)
      .send({ lastName: 'Goble' })

    expect(patched.status).toBe(200)
    expect(patched.body.data.lastName).toBe('Goble')

    const removed = await request(app).delete(`/api/v1/patients/${id}`).set(auth)
    expect(removed.status).toBe(204)

    const gone = await request(app).get(`/api/v1/patients/${id}`).set(auth)
    expect(gone.status).toBe(404)
  })

  it('returns 404 when updating a patient that does not exist', async () => {
    const res = await request(app)
      .patch(`/api/v1/patients/${randomUUID()}`)
      .set(auth)
      .send({ lastName: 'Nobody' })

    expect(res.status).toBe(404)
  })
})
