# OpenClaw / NemoClaw Production Setup

Enterprise deployment guide for running OpenClaw or NemoClaw on a different host from HiTechClaw AI.

---

## Top Failure Modes

The most common production mistakes are:

1. `MC_INGEST_URL` points to `http://localhost:3000/api/ingest` even though the runtime is on a different host.
2. `MC_AGENT_TOKENS` is configured in the wrong format on the HiTechClaw AI server.
3. Manual test payloads use `type` instead of `event_type`.
4. Gateway tokens do not match between OpenClaw and HiTechClaw AI.

If OpenClaw runs on `claw-ai.example.com` and HiTechClaw AI runs on `ai.example.com`, then this is wrong on the OpenClaw host:

```bash
MC_INGEST_URL=http://localhost:3000/api/ingest
```

Use the public HiTechClaw AI endpoint instead:

```bash
MC_INGEST_URL=https://ai.example.com/api/ingest
```

`localhost` is valid only when the runtime and HiTechClaw AI are on the same machine.

---

## Correct Mapping Between Both Sides

### OpenClaw or NemoClaw runtime → HiTechClaw AI

Use these on the runtime host:

```bash
MC_INGEST_URL=https://ai.example.com/api/ingest
MC_AGENT_TOKEN=YOUR_AGENT_TOKEN
```

### HiTechClaw AI server accepts that runtime token

Use this on the HiTechClaw AI host:

```bash
MC_AGENT_TOKENS=openclaw:YOUR_AGENT_TOKEN
```

For multiple legacy env-based tokens:

```bash
MC_AGENT_TOKENS=openclaw:token1,agent2:token2
```

Notes:

- `MC_AGENT_TOKENS` is a server-side mapping format.
- The runtime still sends only the raw token in `Authorization: Bearer <token>`.
- New setup-generated agents can also authenticate through the database-backed token store.

### HiTechClaw AI server → OpenClaw gateway

```bash
NEXT_PUBLIC_GATEWAY_URL=https://claw-ai.example.com
GATEWAY_AUTH_TOKEN=YOUR_GATEWAY_TOKEN
```

### OpenClaw gateway callback → HiTechClaw AI

```bash
GATEWAY_HOOKS_URL=https://ai.example.com/api/ingest
GATEWAY_HOOK_TOKEN=YOUR_MGMT_API_KEY
```

---

## Recommended Sanitized Configuration

### OpenClaw `.env`

```bash
OPENCLAW_VERSION=latest

OPENCLAW_GATEWAY_PORT=18789
OPENCLAW_GATEWAY_TOKEN=CHANGE_THIS_GATEWAY_TOKEN
OPENCLAW_MGMT_API_KEY=CHANGE_THIS_MGMT_API_KEY

DOMAIN=claw-ai.example.com

MC_INGEST_URL=https://ai.example.com/api/ingest
MC_AGENT_TOKEN=CHANGE_THIS_AGENT_TOKEN

ACME_EMAIL=you@example.com
CADDY_TLS=
CADDY_ACME_EMAIL_DIRECTIVE=email you@example.com

NODE_OPTIONS=--max-old-space-size=7956
```

### HiTechClaw AI `.env.local`

```bash
DATABASE_URL=postgresql://hitechclaw-ai:hitechclaw-ai@localhost:5432/hitechclaw-ai
POSTGRES_USER=hitechclaw-ai
POSTGRES_PASSWORD=CHANGE_THIS
POSTGRES_DB=hitechclaw-ai

MC_ADMIN_TOKEN=CHANGE_THIS_ADMIN_TOKEN
MC_AGENT_TOKENS=openclaw:CHANGE_THIS_AGENT_TOKEN

HITECHCLAW_AI_BASE_URL=https://ai.example.com

NEXTAUTH_SECRET=CHANGE_THIS_NEXTAUTH_SECRET
NEXTAUTH_URL=https://ai.example.com

NEXT_PUBLIC_GATEWAY_URL=https://claw-ai.example.com
GATEWAY_HOOK_TOKEN=CHANGE_THIS_MGMT_API_KEY
GATEWAY_AUTH_TOKEN=CHANGE_THIS_GATEWAY_TOKEN
GATEWAY_HOOKS_URL=https://ai.example.com/api/ingest

NODE_ENV=production
PORT=3000
```

---

## Manual Ingest Test

Use `event_type`, not `type`.

Correct test:

```bash
curl -X POST https://ai.example.com/api/ingest \
  -H "Authorization: Bearer YOUR_AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "message_sent",
    "content": "hello from openclaw",
    "metadata": {
      "source": "manual curl test"
    }
  }'
```

If this succeeds, then:

- token is accepted
- ingest endpoint is reachable
- payload schema is correct

If this fails, inspect:

- app logs
- reverse proxy routing
- token configuration
- whether the runtime can reach the HiTechClaw AI domain

---

## Why an Agent Shows as Offline

An agent is considered online only after it sends telemetry.

Typical reasons for `OFFLINE`:

- wrong `MC_INGEST_URL`
- wrong bearer token
- runtime process not restarted after config change
- payload uses `type` instead of `event_type`
- reverse proxy or firewall blocks `/api/ingest`

After a successful event, HiTechClaw AI updates `sessions.last_active`. The UI then marks the agent online.

---

## Recommended Rollout Order

1. Rotate all secrets and tokens.
2. Fix `MC_AGENT_TOKENS` to `agent-id:token` format if you use env fallback auth.
3. Point `MC_INGEST_URL` and `telemetry.endpoint` to the public HiTechClaw AI URL.
4. Restart HiTechClaw AI.
5. Restart OpenClaw or NemoClaw.
6. Send a manual ingest test.
7. Verify the event appears in the dashboard and the agent leaves `OFFLINE` state.

---

## Restart Commands

HiTechClaw AI:

```bash
docker compose up -d
```

OpenClaw system service:

```bash
systemctl restart openclaw
```

If you use the user service form:

```bash
systemctl --user restart openclaw-gateway.service
```

---

## Troubleshooting Checklist

- Confirm `MC_INGEST_URL` is not pointing to the local runtime host by mistake.
- Confirm the request header uses `Authorization: Bearer YOUR_AGENT_TOKEN`.
- Confirm the request body contains `event_type`.
- Confirm `MC_AGENT_TOKENS` on the server is formatted as `agent-id:token` pairs.
- Confirm `NEXTAUTH_SECRET` is stable across redeploys.
- Confirm `OPENCLAW_GATEWAY_TOKEN` matches `GATEWAY_AUTH_TOKEN` where required.
- Confirm app logs show successful `POST /api/ingest` requests.

---

## Related Docs

- [INSTALL.md](../INSTALL.md)
- [QUICKSTART.md](../QUICKSTART.md)
- [API.md](../API.md)
- [docs/development.md](development.md)

---

Use sanitized values in documentation and rotate any real token that was exposed during testing.
