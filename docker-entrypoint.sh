#!/bin/sh
set -e

echo "==> Axon entrypoint"

# --- 1. Wait for Postgres ----------------------------------------------------
if [ -n "$DB_HOST" ]; then
  echo "==> Waiting for PostgreSQL at ${DB_HOST}:${DB_PORT:-5432}…"
  RETRIES=40
  until pg_isready -h "$DB_HOST" -p "${DB_PORT:-5432}" -U "${DB_USER:-axon}" -q 2>/dev/null; do
    RETRIES=$((RETRIES - 1))
    if [ "$RETRIES" -le 0 ]; then
      echo "ERROR: PostgreSQL never became ready."
      exit 1
    fi
    sleep 1
  done
  echo "==> PostgreSQL is ready."
fi

# --- 2. Generate secrets that were not supplied -------------------------------
# Generated per-container: sessions do not survive a restart unless you pin
# JWT_SECRET yourself, which is what you want in a real deployment.
if [ -z "$JWT_SECRET" ]; then
  JWT_SECRET=$(head -c 32 /dev/urandom | base64 | tr -d '\n')
  export JWT_SECRET
  echo "==> Generated an ephemeral JWT_SECRET (set your own to persist sessions across restarts)"
fi

if [ -z "$APP_ENCRYPTION_KEY" ]; then
  APP_ENCRYPTION_KEY=$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')
  export APP_ENCRYPTION_KEY
  echo "==> Generated an ephemeral APP_ENCRYPTION_KEY"
  echo "    WARNING: stored channel credentials become unreadable after a restart."
  echo "    Set APP_ENCRYPTION_KEY to a fixed 64-char hex value in production."
fi

# --- 3. Apply the schema ------------------------------------------------------
cd /app/server

# `migrate deploy` when migrations are committed, `db push` otherwise, so a
# fresh clone comes up without anyone having to author a migration first.
if [ -d "prisma/migrations" ] && [ -n "$(ls -A prisma/migrations 2>/dev/null)" ]; then
  echo "==> Applying migrations…"
  npx prisma migrate deploy
else
  echo "==> No migrations found - syncing the schema directly…"
  npx prisma db push --skip-generate --accept-data-loss
fi

# --- 4. Seed (idempotent) -----------------------------------------------------
if [ "${SEED_ON_START:-true}" = "true" ]; then
  echo "==> Seeding…"
  npx tsx prisma/seed.ts || echo "WARN: seeding failed - continuing anyway."
fi

# --- 5. Start -----------------------------------------------------------------
cd /app
echo "==> Starting Axon on port ${PORT:-6002}"
exec node server/dist/main.js
