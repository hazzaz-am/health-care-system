import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'

const app = createApp({ disableRateLimit: true })

interface ErrorPayload {
  error: { code: string; message: string; requestId?: string; details?: unknown }
}

describe('application shell', () => {
  it('reports liveness without touching the database', async () => {
    const res = await request(app).get('/healthz')

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ status: 'ok' })
    expect(typeof res.body.uptime).toBe('number')
    expect(typeof res.body.timestamp).toBe('string')
  })

  it('reports readiness, degrading to 503 when the database is unreachable', async () => {
    const res = await request(app).get('/readyz')
    const body = res.body as { status: string; checks: { database: { status: string } } }

    expect([200, 503]).toContain(res.status)
    expect(body.checks.database.status).toBeDefined()

    if (res.status === 503) {
      expect(body.status).toBe('error')
    } else {
      expect(body.status).toBe('ok')
    }
  })

  it('echoes a request id on every response', async () => {
    const res = await request(app).get('/healthz')
    expect(res.headers['x-request-id']).toBeTruthy()
  })

  it('honours an inbound x-request-id for cross-service tracing', async () => {
    const res = await request(app).get('/healthz').set('x-request-id', 'trace-abc-123')
    expect(res.headers['x-request-id']).toBe('trace-abc-123')
  })

  it('sets security headers and hides the framework', async () => {
    const res = await request(app).get('/healthz')

    expect(res.headers['x-powered-by']).toBeUndefined()
    expect(res.headers['x-content-type-options']).toBe('nosniff')
  })

  it('exposes the API version', async () => {
    const res = await request(app).get('/api/v1')

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ version: 'v1', name: 'health-care-system' })
  })

  it('returns a structured 404 for unknown routes', async () => {
    const res = await request(app).get('/api/v1/does-not-exist')
    const body = res.body as ErrorPayload

    expect(res.status).toBe(404)
    expect(body.error.code).toBe('NOT_FOUND')
    expect(body.error.requestId).toBeTruthy()
  })

  it('rejects oversized request bodies before handlers run', async () => {
    const res = await request(app)
      .post('/api/v1/patients')
      .set('Authorization', 'Bearer test-token')
      .send({ firstName: 'x'.repeat(2 * 1024 * 1024) })

    expect(res.status).toBe(413)
  })

  it('returns 401 without a bearer token on protected routes', async () => {
    const res = await request(app).get('/api/v1/patients')
    const body = res.body as ErrorPayload

    expect(res.status).toBe(401)
    expect(body.error.code).toBe('UNAUTHORIZED')
  })
})
