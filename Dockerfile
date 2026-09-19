# syntax=docker/dockerfile:1

# ---------- base ----------
FROM node:24-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

# ---------- dependencies ----------
# Manifests are copied first so the dependency layer is cached independently of
# source changes.
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
# pnpm 10 blocks postinstall scripts unless explicitly allowed. Prisma's
# engines and the native pg bindings need theirs to run.
RUN pnpm install --frozen-lockfile --config.confirmModulesPurge=false \
    --config.strictDepBuilds=false

# ---------- build ----------
FROM deps AS build
COPY . .
# Prisma 7 requires an explicit `prisma generate`; the client is not part of
# the published package and is not committed to the repo.
RUN pnpm exec prisma generate
# A placeholder is required only because config/env.ts parses at import time and
# the build type-checks the whole project.
RUN DATABASE_URL="postgresql://user:pass@localhost:5432/db" pnpm run build

# ---------- runtime ----------
FROM base AS runtime
ENV NODE_ENV=production

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile --config.strictDepBuilds=false \
    && pnpm store prune

# Generated client + compiled output.
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/src/generated ./src/generated
COPY prisma.config.ts ./

# Run unprivileged. The node:alpine image already ships a `node` user (uid 1000).
USER node

EXPOSE 3000

# Liveness only. Readiness is the orchestrator's job against /readyz, which
# requires the database and would otherwise restart healthy containers.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]
