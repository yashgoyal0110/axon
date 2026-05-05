# =============================================================================
# Axon - single-image build.
# The NestJS API and the compiled React SPA are served together on one port.
# =============================================================================

# --- Stage 1: install every workspace dependency ------------------------------
FROM node:22-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json* ./
COPY server/package.json ./server/
COPY web/package.json ./web/

# npm workspaces resolves both packages from the root lockfile.
RUN npm install --no-audit --no-fund


# --- Stage 2: build the API and the SPA --------------------------------------
FROM node:22-alpine AS build

WORKDIR /app

# npm workspaces hoists dependencies into the root node_modules; nested
# server/ and web/ directories only exist when a version conflict forces one,
# so copy the whole installed tree rather than assuming they are there.
COPY --from=deps /app ./
COPY . .

# Prisma needs a URL present at generate time; the real one is injected at run.
ENV DATABASE_URL="postgresql://placeholder:placeholder@placeholder:5432/placeholder"

RUN npm run build -w server
RUN npm run build -w web


# --- Stage 3: runtime --------------------------------------------------------
FROM node:22-alpine AS runner

# openssl is required by Prisma's query engine; curl backs the healthcheck.
RUN apk add --no-cache curl openssl postgresql-client

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=6002
ENV HOST=0.0.0.0

# Production dependencies only - the SPA is already compiled to static files.
COPY package.json package-lock.json* ./
COPY server/package.json ./server/
COPY web/package.json ./web/
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force

# Compiled API + Prisma client, schema and seed
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/server/prisma ./server/prisma
# prisma/seed.ts is executed by tsx at container start and imports
# ../src/flows/flow-templates, so the sources ship alongside dist.
COPY --from=build /app/server/src ./server/src
COPY --from=build /app/server/tsconfig.json ./server/tsconfig.json
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma

# Built SPA - main.ts serves this from ../../web/dist relative to server/dist
COPY --from=build /app/web/dist ./web/dist

# tsx runs the TypeScript seed script at container start.
RUN npm install --no-save --no-audit --no-fund tsx@4.19.3 prisma@6.5.0

COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh

# Run unprivileged.
RUN addgroup --system --gid 1001 axon && \
    adduser --system --uid 1001 --ingroup axon axon && \
    chown -R axon:axon /app

USER axon

EXPOSE 6002

HEALTHCHECK --interval=20s --timeout=5s --start-period=45s --retries=5 \
  CMD curl -fsS http://127.0.0.1:6002/api/health || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
