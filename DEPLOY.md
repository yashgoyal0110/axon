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

```caddyfile
https://distiq.8.229.88.229.sslip.io {
	# … existing DistIQ block, unchanged …
}

servicedock.8.229.88.229.sslip.io {
	reverse_proxy 127.0.0.1:4001
}

https://axon.8.229.88.229.sslip.io {
	# … the Axon block …
	reverse_proxy 127.0.0.1:6002 { … }
}
```

Nothing conflicts: different hostname, different upstream port.

---

## 4. Verify

```bash
curl -sI https://axon.8.229.88.229.sslip.io | head -1        # 200
curl -s  https://axon.8.229.88.229.sslip.io/api/health/ready # {"status":"ok",…}
```

Then in a browser:

1. Open the site - the marketing page should animate in.
2. Sign in as `demo@axon.app` / `demo1234`.
3. Go to **Simulator**, type `hi`, and watch the flow run.
4. Check **Inbox** and **Analytics** - the conversation should appear in both.

If all four work, the deployment is sound. **Change the demo password or set
`SIGNUPS_ENABLED=false`** before sharing the URL.

---

## 5. Connect a WhatsApp number

Once it's public, the webhook URLs Axon generates are reachable, so real
providers can be attached. Go to **Channels → Connect a channel**.

Axon shows you the exact webhook URL per channel, e.g.:

```
https://axon.8.229.88.229.sslip.io/api/webhooks/twilio/<webhookId>
https://axon.8.229.88.229.sslip.io/api/webhooks/meta_cloud/<webhookId>
```

- **Twilio** - paste that into *Phone Numbers → your number → When a message
  comes in*. Signature validation uses `PUBLIC_URL` + the request path, so if
  the URL Twilio calls differs from `PUBLIC_URL` at all (http vs https, a
  trailing slash, a different host) every webhook is rejected with 403.
- **Meta Cloud API** - paste the URL and the verify token Axon generated into
  the app's webhook config. Add the App secret in Axon so
  `X-Hub-Signature-256` is checked.

Use **Test** on the channel card to confirm credentials before going live.

---

## Operations

```bash
docker compose logs -f app          # tail
docker compose restart app          # restart (safe once secrets are pinned)
docker compose up -d --build        # deploy a new version
docker compose down                 # stop, volumes preserved
```

**Backups** - everything lives in the `postgres_data` volume:

```bash
docker compose exec postgres pg_dump -U axon axon | gzip > axon-$(date +%F).sql.gz
```

**Turning off the demo data** - set `SEED_ON_START=false` in `.env` after the
first successful boot.

**Health endpoints** - `/api/health` (liveness) and `/api/health/ready`
(readiness; verifies the database and reports whether Redis and AI are wired).

---

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| 502 from Caddy | Container not up, or still seeding. `docker compose logs app`. |
| Logged out after every restart | `JWT_SECRET` not pinned in `.env`. |
| Channel credentials stop working after a restart | `APP_ENCRYPTION_KEY` not pinned. Re-enter them once fixed. |
| Twilio webhooks return 403 | `PUBLIC_URL` doesn't byte-match the URL Twilio calls. |
| Meta webhook verification fails | Verify token mismatch - copy it again from the channel card. |
| AI steps reply with the fallback message | `GEMINI_API_KEY` unset or out of quota. Check `/api/health/ready`. |


<!-- TODO: extract this into a shared helper -->
<!-- TODO: replace the any casts with real types -->
<!-- FIXME: blows up on an empty payload -->