<div align="center">

# Axon

**Multi-tenant WhatsApp AI chatbot platform.**
Draw the conversation on a canvas, let Gemini handle everything you didn't script, and watch it work in real time.

`React 18` · `NestJS 11` · `Prisma` · `PostgreSQL` · `Redis` · `Gemini` · one Docker image on port **6002**

</div>

---

## What this is

A production-shaped rewrite of a WhatsApp chatbot builder. The original was a
CRA frontend talking to a small Express server with no persistence, no auth and
no tenancy. This version is a platform you could actually sell:

- **Visual flow builder** - eight node types on a React Flow canvas, with
  validation, immutable published versions and one-click rollback.
- **Real multi-tenancy** - every row is scoped to a workspace, with owner /
  admin / agent / viewer roles, invitations and workspace switching.
- **Three channels** - Meta Cloud API, Twilio, and a **credential-free sandbox**
  that runs the real engine in-app so you can build and demo the entire product
  without a WhatsApp Business account.
- **AI that stays on script** - Gemini answers whatever the flow didn't
  anticipate, inside a persona you define, then hands control back.
- **Analytics that mean something** - per-node drop-off, completion rate, AI
  deflection, response latency, channel mix.
- **The unglamorous parts** - rate limiting, plan quotas with live metering,
  API keys, audit log, signed webhooks, encrypted credentials, health probes,
  OpenAPI docs.

---

## Quickstart

```bash
cp .env.example .env          # optionally set GEMINI_API_KEY
docker compose up -d --build
```

Then open **http://localhost:6002** and sign in with:

| Email                | Password   | Role  |
| -------------------- | ---------- | ----- |
| `demo@axon.app`  | `demo1234` | Owner |
| `agent@axon.app` | `demo1234` | Agent |

The seed is idempotent and runs on every start: a workspace, five flows, a
sandbox channel, eight contacts with transcripts, and 30 days of analytics.

> **No Gemini key?** Everything still works. AI steps fall back to the flow's
> configured message and AI flow generation is disabled - nothing errors.

### Running without Docker

```bash
npm install
# server needs DATABASE_URL exported or in the environment
npm run prisma:generate
npx prisma db push --schema server/prisma/schema.prisma
npm run seed
npm run dev            # API on :6002, Vite dev server on :5173
```

---

## Try it in two minutes

1. Sign in and open **Simulator** in the sidebar.
2. Type `hi`. The engine resolves a contact, opens a session and walks the
   published flow from its Start node - exactly as a real webhook would.
3. Tap a quick reply. Watch the badge on each bubble: `flow` when a node
   produced it, `AI` when Gemini did.
4. Open **Inbox** - the conversation is there. Open **Analytics** - it counted.

That entire loop runs with no Meta account, no Twilio account and no public URL.

---

## Architecture

```
┌────────────── one container, port 6002 ──────────────┐
│                                                       │
│   React SPA (Vite build)  ←─ served statically ─┐     │
│                                                  │     │
│   NestJS API  /api/*                             │     │
│     ├── auth        JWT + rotating refresh tokens│     │
│     ├── orgs        members, invites, API keys   │     │
│     ├── flows       CRUD, versions, AI generation│     │
│     ├── channels    provider credentials (AES)   │     │
│     ├── webhooks    signature-verified inbound   │     │
│     ├── engine      the conversation runtime     │     │
│     ├── analytics   funnels, deltas, series      │     │
│     └── billing     plans, quotas, metering      │     │
└───────────────────────────────────────────────────────┘
          │                        │
     PostgreSQL               Redis (optional)
```

### The engine

One code path serves every provider, so the sandbox and production behave
identically:

1. **Verify** the webhook signature - HMAC-SHA256 for Meta, HMAC-SHA1 for Twilio.
2. **Dedupe** against a redelivery guard keyed on the provider message id.
3. **Resolve** the contact and check the 24-hour session window; a lapsed
   session is closed rather than resumed mid-flow.
4. **Advance** node by node, bounded at 15 hops per turn, until a step waits
   for a reply or terminates.
5. **Fall back to AI** when a reply matches no option - with the transcript,
   the captured variables and the flow's persona.
6. **Dispatch** replies and meter usage, latency and daily stats.

### Node types

| Node          | Behaviour                                                                  |
| ------------- | -------------------------------------------------------------------------- |
| **Start**     | Single entry point. Trigger keywords route contacts in.                    |
| **Message**   | Sends text, moves straight on.                                             |
| **Question**  | Text plus quick replies, then waits. Matches by text, number or substring. |
| **Capture**   | Sends a prompt, waits, stores the raw reply in a named variable.           |
| **AI**        | Gemini answers in your persona, then the flow continues.                   |
| **Condition** | Rules against captured variables, top-down. First match wins.              |
| **Handoff**   | Parks the conversation for a human agent; the bot stops replying.          |
| **End**       | Closing message, conversation marked complete.                             |

Any message body interpolates captured values: `Thanks {{contactName}}, sending
the quote to {{email}} now.`

---

## Connecting a real number

Both providers are configured in **Channels**, and both hand you a webhook URL
to paste into the provider console.

### Meta Cloud API

1. Create an app at developers.facebook.com, add the **WhatsApp** product.
2. Copy the **Phone number ID** and generate a permanent **System User token**
   with `whatsapp_business_messaging`.
3. Add the **App secret** so inbound webhooks are signature-verified.
4. Paste Axon's webhook URL and verify token into the app's webhook config.

### Twilio

1. Copy your **Account SID** and **Auth token** from the Twilio console.
2. Set the WhatsApp sender, e.g. `+14155238886`.
3. Point _"When a message comes in"_ at Axon's webhook URL.

Credentials are validated on save, encrypted with AES-256-GCM before storage,
and never returned by the API - the UI only reports which fields are populated.

---

## Plans and limits

|                    | Sandbox | Starter        | Pro            | Enterprise |
| ------------------ | ------- | -------------- | -------------- | ---------- |
| Price              | Free    | $29/mo         | $99/mo         | Custom     |
| Messages / month   | 250     | 1,000          | 100,000        | Unlimited  |
| AI replies / month | 10      | 300            | 40,000         | Unlimited  |
| Flows              | 3       | 10             | 50             | Unlimited  |
| Channels           | 1       | 2              | 10             | Unlimited  |
| Seats              | 2       | 5              | 25             | Unlimited  |
| Providers          | Sandbox | + Twilio, Meta | + Twilio, Meta | All        |

Quota checks run before every send and every AI call. When a ceiling is reached
the outbound message is still written, marked `FAILED` with the reason attached,
so nothing vanishes silently.

**Rate limits:** 240 req/min per IP globally, 10/min on credential endpoints,
60/min on the simulator (it can trigger AI calls), 600/min on provider webhooks.

---

## API

Everything the dashboard does is available over HTTP. Authenticate with a bearer
token from `/api/auth/login`, or a workspace API key.

```bash
# Create a key in Settings → API keys
curl https://your-host/api/flows -H "x-api-key: ax_<prefix>_<secret>"

# Push a message through the engine on a sandbox channel
curl -X POST https://your-host/api/conversations/simulate \
  -H "x-api-key: ax_<prefix>_<secret>" \
  -H "content-type: application/json" \
  -d '{"text":"hello","waId":"+15550000001"}'
```

Live OpenAPI explorer at **`/api/docs`**.

---

## Configuration

| Variable                          | Default                 | Notes                                                                                       |
| --------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------- |
| `PORT`                            | `6002`                  | The single port everything is served on                                                     |
| `DATABASE_URL`                    | -                       | **Required**                                                                                |
| `PUBLIC_URL`                      | `http://localhost:6002` | Used for webhook and invite URLs                                                            |
| `JWT_SECRET`                      | generated               | **Pin this** - otherwise sessions die on restart                                            |
| `APP_ENCRYPTION_KEY`              | generated               | **Pin this** (64 hex chars) - otherwise stored channel credentials break on restart          |
| `GEMINI_API_KEY`                  | -                       | Optional. Enables AI replies and flow generation                                             |
| `GEMINI_MODEL`                    | `gemini-2.5-flash`      |                                                                                             |
| `ENABLE_REDIS` / `REDIS_URL`      | `true` / compose        | Falls back to in-process caching                                                             |
| `THROTTLE_LIMIT` / `THROTTLE_TTL` | `240` / `60`            | Global rate limit                                                                            |
| `SIGNUPS_ENABLED`                 | `true`                  | Set `false` for a closed instance                                                            |
| `SEED_ON_START`                   | `true`                  | Idempotent demo seed                                                                         |
| `UPGRADE_COUPON`                  | `Yash@0110`             | Code required to move onto any paid plan. Empty disables upgrades                            |

---

## Project layout

```
server/                  NestJS API
  prisma/schema.prisma   Multi-tenant data model
  prisma/seed.ts         Idempotent demo seed
  src/
    auth/                JWT, refresh rotation, RBAC guard
    orgs/                Members, invitations, API keys, audit
    flows/               CRUD, versions, templates, AI generation, preview
    channels/            Provider config, credential encryption, testing
    messaging/           Provider adapters (Meta, Twilio, Sandbox)
    engine/              The conversation runtime
    conversations/       Inbox + the simulator endpoint
    analytics/           Overview, funnels, per-flow, per-channel
    billing/             Plans, quotas, metering
    webhooks/            Signature-verified public inbound
    visits/              Buffered public-site traffic counter
web/                     React SPA
  src/components/ui/     Design system
  src/components/flow/   Canvas nodes + inspector
  src/pages/marketing/   Landing, product, pricing, templates, docs
  src/pages/app/         Dashboard, builder, simulator, inbox, analytics…
Dockerfile               Single image, both halves
docker-compose.yml       App + Postgres + Redis
```

---

## Security notes

- Passwords hashed with bcrypt (cost 12); login returns an identical error for
  unknown-user and wrong-password so it can't be used to enumerate accounts.
- Access tokens are short-lived; refresh tokens are opaque, hashed at rest, and
  rotated on every use. Changing a password revokes every other session.
- Membership is re-checked on every request, so a revoked seat takes effect
  immediately rather than when the access token expires.
- Channel credentials are AES-256-GCM encrypted and never returned by the API.
- Webhook signatures are verified with constant-time comparison.
- Helmet, CORS locked to `PUBLIC_URL` in production, `trust proxy` for correct
  client IPs behind a reverse proxy.

---

<div align="center">
<sub>Not affiliated with WhatsApp or Meta Platforms, Inc.</sub>
</div>
