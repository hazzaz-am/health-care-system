# Health Care System — TypeScript + Express 5 + Prisma 7 API

Production-shaped REST API. Node 24, ESM, Express 5, Prisma 7 (Postgres), Zod 4.

```
src/
  index.ts                    entry: listen + graceful shutdown, no app logic
  app.ts                      createApp() -> Express instance (no listen, testable)
  config/
    env.ts                    Zod-validated environment, parsed once at boot
    logger.ts                 pino (pretty in dev, JSON in prod, PHI redaction)
  middleware/
    requestLogger.ts          request correlation id + pino-http
    errorHandler.ts           terminal error mapper; notFound
    validate.ts               Zod request validation (body/query/params)
    requireAuth.ts            auth gate (stub — replace the token check)
  routes/
    index.ts                  /api/v1 composition
    health.routes.ts          /healthz (liveness) + /readyz (readiness)
  modules/
    health/health.service.ts  database readiness probe
  db/client.ts                PrismaClient + pg driver adapter (required in v7)
  lib/errors.ts               AppError hierarchy
  lib/asyncContext.ts         AsyncLocalStorage request scope
  types/express.d.ts          Request.user augmentation
prisma/schema.prisma          data model
prisma.config.ts              Prisma 7 CLI config (connection string lives here)
tests/                        Vitest + Supertest
```

## Prerequisites

- Node >= 22 (developed against 24.20.0)
- pnpm 10
- PostgreSQL

## Quick start

```bash
pnpm install
pnpm db:generate          # required: Prisma 7 generates into src/generated/
cp .env.example .env      # then edit DATABASE_URL
pnpm dev                  # http://localhost:3000
```

`prisma/schema.prisma` currently has **no models** — add your own. Until you do,
`pnpm db:migrate` has nothing to apply. After adding models, run:

```bash
pnpm db:generate
pnpm db:migrate --name init
```

Verify:

```bash
curl http://localhost:3000/healthz   # liveness
curl http://localhost:3000/readyz    # readiness (probes the database)
curl http://localhost:3000/api/v1
```

## Scripts

| Script                      | Purpose                               |
| --------------------------- | ------------------------------------- |
| `pnpm dev`                  | Watch mode via tsx, loads `.env`      |
| `pnpm build`                | Compile to `dist/` with tsc           |
| `pnpm start`                | Run compiled output                   |
| `pnpm typecheck`            | `tsc --noEmit`                        |
| `pnpm lint` / `pnpm format` | ESLint (type-aware) / Prettier        |
| `pnpm test`                 | Vitest + Supertest                    |
| `pnpm db:generate`          | Prisma client codegen                 |
| `pnpm db:migrate`           | Create + apply a migration (dev)      |
| `pnpm db:deploy`            | Apply pending migrations (production) |

## Things that differ from most tutorials

Five changes in the current major versions will break copy-pasted code:

1. **Express 5 handles async errors.** A rejected promise in a handler is
   forwarded to the error middleware automatically. `express-async-errors` and
   `asyncHandler()` wrappers are obsolete — don't add them.
2. **Prisma 7 no longer generates into `node_modules`.** The generator provider
   is `prisma-client`, `output` is required, and you import from the generated
   path (`src/generated/prisma/client.js`). Run `pnpm db:generate` after every
   clone and in CI before build.
3. **The Prisma connection string moved to `prisma.config.ts`.** The datasource
   block has no `url` in v7. Migrations read `datasource.url` from the config file.
4. **Prisma 7 requires a driver adapter.** There is no built-in engine; `pg` owns
   the connection pool now, and its defaults differ from Prisma 6 (no connection
   timeout by default), so the pool is configured explicitly in `src/db/client.ts`.
5. **Pin `prisma` and `@prisma/client` to the same version.** At the time of
   writing, npm's `latest` tag for the `prisma` CLI pointed at an 8.0.0 release
   candidate while `@prisma/client` was still 7.10.0 — a bare
   `pnpm add prisma @prisma/client` installs a mismatched pair that fails codegen.

## Design decisions worth knowing

**ESM with `nodenext`.** Prisma 7 is ESM-only. `moduleResolution: nodenext` means
**every relative import needs a `.js` extension**, even in `.ts` files:
`import { env } from './config/env.js'`. This is the single most common
stumbling block when moving to ESM. The alternative (`bundler` resolution)
permits extensionless imports but assumes a bundler resolves them at runtime —
wrong for `node dist/index.js`.

**`noUncheckedIndexedAccess`.** `arr[0]` is `T | undefined`. Slightly noisier,
but it removes a whole class of runtime crashes.

**`erasableSyntaxOnly`.** Bans `enum`, parameter properties, and namespaces —
the constructs Node's native type-stripping cannot handle. Consequence: no
`constructor(readonly x: T)` shorthand; declare fields explicitly.

**Express types never cross into `service/` or `repo/`.** Controllers translate
HTTP into plain calls. This is what makes business logic testable without a
server and keeps the codebase navigable.

**Liveness never touches the database.** `/healthz` returns 200 whenever the
process is up. If it probed the database, a transient blip would fail the probe
and an orchestrator would restart every healthy container at once. `/readyz`
does the database probe and is what a load balancer should use.

**Middleware order.** `trust proxy` → logger → helmet → CORS → body parsers →
rate limit → routes → 404 → error handler. `trust proxy` must precede the rate
limiter or every client behind a proxy is throttled as one.

**The error handler takes exactly four parameters.** Express detects error
middleware by arity; drop the unused `next` and it silently stops catching anything.

**PHI redaction.** `config/logger.ts` redacts authorization headers, cookies,
and common PHI fields. Extend the `redact.paths` list as the schema grows.


No controller, route, or test changes — that is the point of the port.

## Database migrations

```bash
pnpm db:migrate   # dev: create + apply
pnpm db:deploy                       # prod: apply pending only
pnpm db:studio                       # browse data
```

> **Windows note.** `SIGTERM` is not delivered the way it is on Linux (Node maps
> it to `TerminateProcess`), so the graceful-shutdown handler cannot be exercised
> from a Windows shell. `SIGINT` (Ctrl+C) is handled and works. Under Docker or
> Kubernetes on Linux, `SIGTERM` behaves normally.

## Docker

```bash
docker build -t health-care-system .
docker run --rm -p 3000:3000 \
  -e DATABASE_URL="postgresql://user:pass@host:5432/healthcare" \
  health-care-system
```

Multi-stage build, runs as the unprivileged `node` user, liveness `HEALTHCHECK`
against `/healthz`. Point your orchestrator's readiness probe at `/readyz`.

## Still to do before production

- Replace `requireAuth` with real JWT/session verification.
- Swap the in-memory repository for the Prisma implementation.
- Add OpenAPI docs (e.g. `zod-openapi`) generated from the Zod schemas.
- Add audit logging for PHI access — a compliance requirement in most jurisdictions.
- Configure a shared rate-limit store (Redis) if running more than one instance;
  the default in-memory limiter is per-process.
