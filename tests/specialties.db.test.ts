import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/db/client.js'
import { p2002Fields } from '../src/middleware/errorHandler.js'

const app = createApp({ disableRateLimit: true })

/** Unique per run, so a leftover row can never collide with a later run. */
const RUN = Date.now()
const LIVE_TITLE = `E2E-LIVE-${RUN}`
const RACE_TITLE = `E2E-RACE-${RUN}`
const RAW_TITLE = `E2E-RAW-${RUN}`
const ALL_TITLES = [LIVE_TITLE, RACE_TITLE, RAW_TITLE]

interface ErrorPayload {
  error: {
    code: string
    message: string
    details?: { fields?: string[] }
  }
}

/**
 * The one thing unit tests cannot cover: what a *real* Postgres unique
 * violation actually puts in the metadata `p2002Fields` reads.
 *
 * `tests/errorHandler.test.ts` builds that metadata by hand, from the shape read
 * out of the shipped adapter. That pins our mapping, but it cannot prove the
 * database still populates the field we depend on — and it did not: the first
 * version of this suite showed the adapter drops Postgres's `detail` line, so
 * the column has to come from the index name. Unit tests alone would have
 * shipped the generic "Resource already exists" message.
 *
 * Requires a migrated database. Kept out of `pnpm test` so that suite never
 * depends on one; run `pnpm test:db`, which loads `.env`.
 *
 * Each test uses its own title and cleans up, including soft-deleted rows, so
 * the file is safe to re-run and its cases are order-independent.
 */
describe('specialties API against a real database', () => {
  beforeAll(async () => {
    await prisma.$connect()
    await prisma.specialty.deleteMany({ where: { title: { in: ALL_TITLES } } })
  })

  afterAll(async () => {
    await prisma.specialty.deleteMany({ where: { title: { in: ALL_TITLES } } })
    await prisma.$disconnect()
  })

  it('reports a duplicate title as a 409 naming the real column', async () => {
    const first = await request(app).post('/api/v1/specialties').send({ title: LIVE_TITLE })
    expect(first.status).toBe(201)

    const second = await request(app).post('/api/v1/specialties').send({ title: LIVE_TITLE })
    const body = second.body as ErrorPayload

    // The service's own pre-check catches this before the insert, so this
    // asserts the public contract rather than which layer produced the message.
    expect(second.status).toBe(409)
    expect(body.error.code).toBe('CONFLICT')
    expect(body.error.message).toContain('title')
  })

  it('names the column when only the unique index rejects the insert', async () => {
    const created = await request(app).post('/api/v1/specialties').send({ title: RACE_TITLE })
    expect(created.status).toBe(201)

    const id = (created.body as { data: { id: string } }).data.id
    const deleted = await request(app).delete(`/api/v1/specialties/${id}`)
    expect(deleted.status).toBe(204)

    // `findByTitle` only matches live rows, so the soft-deleted row slips past
    // the service's pre-check and the unique index — which is global, not
    // partial on `isDeleted` — is what rejects the insert. This is the only way
    // to obtain a genuine P2002 from this schema, and therefore the only test
    // that exercises the mapper's real-world path end to end.
    const res = await request(app).post('/api/v1/specialties').send({ title: RACE_TITLE })
    const body = res.body as ErrorPayload

    expect(res.status).toBe(409)
    expect(body.error.code).toBe('CONFLICT')
    expect(body.error.message).toBe('A record with this title already exists')
    expect(body.error.details).toEqual({ fields: ['title'] })
  })

  it('parses the metadata a real Prisma error carries', async () => {
    await request(app).post('/api/v1/specialties').send({ title: RAW_TITLE })

    // Capture the raw error rather than the response, so a failure here shows
    // the actual metadata instead of just a wrong HTTP body.
    const raw = await prisma.specialty
      .create({ data: { title: RAW_TITLE } })
      .then(() => undefined)
      .catch((error: unknown) => error)

    expect(raw).toBeInstanceOf(Error)

    const meta = (raw as { meta?: Record<string, unknown> }).meta
    expect(p2002Fields(meta)).toEqual(['title'])
  })
})
