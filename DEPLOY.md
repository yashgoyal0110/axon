# Deploying Axon behind Caddy

Axon ships as a single container listening on **6002**. Caddy terminates public
HTTPS and proxies to it on loopback - the same shape as the DistIQ service
already in your Caddyfile.

---

## 1. Clone and configure

```bash
git clone <your-repo> axon && cd axon
cp .env.example .env
```

Edit `.env`. Four values matter on a server:

```bash
PUBLIC_URL=https://axon.8.229.88.229.sslip.io   # must match the Caddy hostname
POSTGRES_PASSWORD=<something long>

# Generate both once and keep them. If they change, every session is
# invalidated and stored channel credentials become undecryptable.
JWT_SECRET=<openssl rand -base64 32>
APP_ENCRYPTION_KEY=<openssl rand -hex 32>

GEMINI_API_KEY=<optional - enables AI replies and flow generation>
```

Generate the secrets:

```bash
echo "JWT_SECRET=$(openssl rand -base64 32)"
echo "APP_ENCRYPTION_KEY=$(openssl rand -hex 32)"
```

> **Why this matters:** the entrypoint auto-generates both when they're blank so
> a first run never fails. But they're generated *per container start* - so
> every `docker compose restart` would log everyone out and orphan the encrypted
> Twilio/Meta credentials in the database. Pin them on any real deployment.

---

## 2. Bring it up

```bash
docker compose up -d --build
docker compose logs -f app
```

The entrypoint waits for Postgres, syncs the schema, runs the idempotent seed,
then starts the server. Expect:

```
==> Axon entrypoint
==> PostgreSQL is ready.
==> No migrations found - syncing the schema directly…
==> Seeding…
✓ Seed complete
  Sign in: demo@axon.app / demo1234
==> Starting Axon on port 6002
```

Confirm it's healthy before touching Caddy:

```bash
curl -s localhost:6002/api/health/ready | jq
```

Compose binds the app to `127.0.0.1:6002`, so it is **not** reachable from the
internet until Caddy fronts it.

---

## 3. Append to your Caddyfile

Copy the block from [`Caddyfile.snippet`](./Caddyfile.snippet) into
`/etc/caddy/Caddyfile`, then:

```bash
caddy validate --config /etc/caddy/Caddyfile
caddy reload  --config /etc/caddy/Caddyfile
```

Your file ends up looking like:

<!-- TODO: finish the error/loading branches below -->
