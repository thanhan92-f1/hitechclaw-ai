# Installation Guide

Complete guide to installing and running HiTechClaw AI.

Repository usage is governed by [LICENSE](LICENSE) and [COMMERCIAL-LICENSE.md](COMMERCIAL-LICENSE.md). For support and reporting routes, see [SUPPORT.md](SUPPORT.md) and [SECURITY.md](SECURITY.md).

---

## Prerequisites

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| Docker + Docker Compose | v20+ / v2+ | Latest |
| RAM | 2 GB | 4 GB |
| Disk | 5 GB | 20 GB |
| Ports | 3000 (app), 5432 (database) | — |

No Node.js, PostgreSQL, or other dependencies needed — Docker handles everything.

For local host-based development where only the database runs in Docker, see [docs/development.md](docs/development.md).

If you only need the JavaScript client library, install the published SDK instead of the full application:

```bash
npm install @hitechclaw-ai/sdk@0.1.0
```

For SDK usage examples, troubleshooting, and package-specific release notes, see [`packages/sdk/README.md`](packages/sdk/README.md) and [`packages/sdk/CHANGELOG.md`](packages/sdk/CHANGELOG.md).

Repository maintainers can build the SDK package locally with:

```bash
npm run build:sdk
npm run pack:sdk
```

To publish it from GitHub Actions, add an `NPM_TOKEN` repository secret, confirm the version in `packages/sdk/package.json`, and create a tag such as `sdk-v0.1.0`, or run `.github/workflows/npm-publish.yml` manually.

```bash
npm run check:sdk-version -- 0.1.0
git tag sdk-v0.1.0
git push origin sdk-v0.1.0
```

---

## Step 1: Clone the Repository

```bash
git clone https://github.com/thanhan92-f1/hitechclaw-ai.git
cd hitechclaw-ai
```

## Step 2: Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your preferred editor. At minimum, set these:

```bash
# Database password (also used by Docker Compose to create the DB)
POSTGRES_PASSWORD=your-secure-password

# Admin login passphrase (min 12 characters)
MC_ADMIN_TOKEN=your-admin-passphrase-here

# Agent authentication tokens (agent-id:token pairs)
# Example: openclaw:your-agent-token-here,agent2:another-token
MC_AGENT_TOKENS=openclaw:your-agent-token-here

# Base URL (where HiTechClaw AI is accessible)
HITECHCLAW_AI_BASE_URL=http://localhost:3000

# Session encryption (generate with: openssl rand -base64 32)
NEXTAUTH_SECRET=your-generated-secret-here
NEXTAUTH_URL=http://localhost:3000
```

See [.env.example](.env.example) for all optional variables (notifications, gateway integration, infrastructure monitoring).

## Step 3: Start HiTechClaw AI

```bash
docker compose up -d
```

If you prefer the prebuilt GitHub Container Registry image, pull it directly:

```bash
docker pull ghcr.io/thanhan92-f1/hitechclaw-ai:latest
```

The repository also publishes branch and SHA-scoped package tags automatically on pushes to `main` when container-impacting files change. Tagged releases such as `v0.1.0` publish matching versioned GHCR image tags through the release workflow.

Published GHCR images are multi-arch and currently include `linux/amd64` and `linux/arm64` manifests.

Published GHCR images also include provenance and SBOM attestations to support downstream supply-chain verification.

Published GHCR images are also keylessly signed with Sigstore/Cosign through GitHub OIDC, so downstream environments can verify both origin and integrity.

### Verify container signatures and attestations

Install `cosign` first, then verify the published image against GitHub's OIDC issuer and this repository's publish workflows:

```bash
cosign verify ghcr.io/thanhan92-f1/hitechclaw-ai:latest \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  --certificate-identity-regexp 'https://github.com/thanhan92-f1/hitechclaw-ai/.github/workflows/(docker-publish|release)\.yml@.*'
```

Verify the provenance attestation:

```bash
cosign verify-attestation ghcr.io/thanhan92-f1/hitechclaw-ai:latest \
  --type slsaprovenance \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  --certificate-identity-regexp 'https://github.com/thanhan92-f1/hitechclaw-ai/.github/workflows/(docker-publish|release)\.yml@.*'
```

Verify the SBOM attestation:

```bash
cosign verify-attestation ghcr.io/thanhan92-f1/hitechclaw-ai:latest \
  --type spdxjson \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  --certificate-identity-regexp 'https://github.com/thanhan92-f1/hitechclaw-ai/.github/workflows/(docker-publish|release)\.yml@.*'
```

For stricter production pinning, replace `:latest` with a version tag such as `:v0.1.0` or an immutable digest reference.

You can also run the bundled helper locally:

```bash
npm run verify:ghcr
```

The helper script defaults to `ghcr.io/thanhan92-f1/hitechclaw-ai:latest` and runs signature, provenance, and SBOM verification in sequence.

To verify a specific tag or digest, pass it through after `--`:

```bash
npm run verify:ghcr -- ghcr.io/thanhan92-f1/hitechclaw-ai:v0.1.0
```

To override the OIDC issuer or workflow identity pattern explicitly, call the helper script directly:

```powershell
pwsh -ExecutionPolicy Bypass -File ./scripts/verify-ghcr-image.ps1 `
  -ImageRef ghcr.io/thanhan92-f1/hitechclaw-ai:v0.1.0 `
  -Issuer https://token.actions.githubusercontent.com `
  -Identity 'https://github.com/thanhan92-f1/hitechclaw-ai/.github/workflows/(docker-publish|release)\.yml@.*'
```

For CI or audit tooling, request JSON output:

```powershell
pwsh -ExecutionPolicy Bypass -File ./scripts/verify-ghcr-image.ps1 `
  -ImageRef ghcr.io/thanhan92-f1/hitechclaw-ai:v0.1.0 `
  -OutputMode json
```

This starts:
- **hitechclaw-ai** — The application on port 3000
- **db** — TimescaleDB (PostgreSQL) on port 5432

Migrations run automatically on first startup.

## Step 4: Run the Setup Wizard

Open `http://localhost:3000` in your browser. The setup wizard guides you through:

1. **Create your account** — Organization name, admin email, password
2. **Register one or more agents** — Name, framework, install mode, optional SSH target, generates an API token per agent
3. **Install and configure agents** — Copy-paste per-agent integration code or let the wizard deploy config over SSH
4. **Send your first event** — Test button or curl command for the selected agent
5. **Explore** — Quick links to key features

You can provision OpenClaw and NemoClaw in parallel during the same setup run. The wizard generates isolated tokens, config paths, and install snippets for each agent to avoid conflicts.

### OpenClaw first-time setup

If an agent runs on OpenClaw, choose **OpenClaw** in step 2. In step 3, the wizard gives you a ready-to-paste bootstrap block for that agent, and can optionally push it over SSH.

Use the generated values on the OpenClaw host:

```bash
cd /path/to/your/openclaw-agent

cat >> .env <<'EOF'
MC_INGEST_URL=https://ai.example.com/api/ingest
MC_AGENT_TOKEN=YOUR_GENERATED_AGENT_TOKEN
EOF

systemctl --user restart openclaw-gateway.service
```

> Use `localhost` only when OpenClaw and HiTechClaw AI run on the same machine. If OpenClaw runs on `claw-ai.example.com` and HiTechClaw AI runs on `ai.example.com`, `MC_INGEST_URL` must point to the HiTechClaw AI host, for example `https://ai.example.com/api/ingest`.

Then go back to the wizard, select that agent, and click **Start Listening** or **Send Test Event**.

### NemoClaw first-time setup

If an agent runs on NemoClaw, choose **NemoClaw** in step 2. In step 3, copy the generated telemetry block into your runtime config, or let the wizard apply it remotely:

```yaml
telemetry:
  endpoint: https://ai.example.com/api/ingest
  token: YOUR_GENERATED_AGENT_TOKEN
```

Use `localhost` here only for single-host development. For split deployments, set `telemetry.endpoint` to the public HiTechClaw AI URL.

Restart or reload NemoClaw, then return to the wizard, select that agent, and verify the first event arrives.

## Step 5: Send Your First Event

Using the token generated during setup:

```bash
curl -X POST https://ai.example.com/api/ingest \
  -H "Authorization: Bearer YOUR_AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "message_sent",
    "content": "Hello from my agent!",
    "metadata": { "model": "claude-sonnet-4-6", "tokens": 150 }
  }'
```

You should see the event appear on the dashboard within seconds.

## Step 6: Add Server Monitoring (Optional)

To monitor your servers' health, register nodes in HiTechClaw AI and set up metric reporting.

**Option A: Push-based (recommended)**

Create a reporter script on each server that POSTs metrics to `/api/infra/report`:

```bash
#!/bin/bash
curl -s -X POST https://your-hitechclaw-ai-url/api/infra/report \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"hostname\": \"$(hostname)\",
    \"cpu_percent\": $(cat /proc/loadavg | awk '{print $1 * 100 / '$(nproc)'}'),
    \"memory_percent\": $(free | awk '/Mem:/ {printf "%.1f", $3/$2 * 100}'),
    \"disk_percent\": $(df / | awk 'NR==2 {print $5}' | tr -d '%')
  }"
```

Schedule with cron: `* * * * * /path/to/reporter.sh`

**Option B: SSH-based collection**

Configure `MC_CRON_KEY_PATH` in `.env` and register nodes with SSH credentials via the API.

---

## Troubleshooting

For local host-based development and isolated Playwright testing, prefer the workflows in [docs/development.md](docs/development.md), including `npm run dev:up`, `npm run test:setup`, and `npm run test:e2e:managed`.

### Port 3000 or 5432 already in use

```bash
# Check what's using the port
lsof -i :3000
# Or change the port in .env and docker-compose.yml
```

> **Note:** HiTechClaw AI defaults to port 3000. If you change the port (via the `PORT` environment variable or in `ecosystem.config.js`), make sure your reverse proxy config points to the same port.

### Database connection refused

```bash
# Check the database container is running
docker compose ps
docker compose logs db
```

### Migrations failed

```bash
# Re-run migrations
docker compose exec hitechclaw-ai npx tsx scripts/migrate.ts
# Or check the logs
docker compose logs hitechclaw-ai | grep -i migration
```

### Events not appearing on dashboard

1. Check `MC_INGEST_URL` or `telemetry.endpoint` points to the HiTechClaw AI host, not the local OpenClaw or NemoClaw host
2. Check the agent token matches the raw bearer token you send from the runtime
3. If you use env-based fallback tokens, format `MC_AGENT_TOKENS` as comma-separated `agent-id:token` pairs such as `openclaw:token1,agent2:token2`
4. Test the ingest endpoint directly: `curl https://ai.example.com/api/health`
5. Check application logs: `docker compose logs hitechclaw-ai -f`

### Recommended split-host production mapping

When HiTechClaw AI and OpenClaw run on different hosts, keep the roles separated clearly:

- OpenClaw sends telemetry to HiTechClaw AI with:
  - `MC_INGEST_URL=https://ai.example.com/api/ingest`
  - `MC_AGENT_TOKEN=<agent token>`
- HiTechClaw AI accepts that token with:
  - `MC_AGENT_TOKENS=openclaw:<agent token>`
- HiTechClaw AI controls the OpenClaw gateway with:
  - `NEXT_PUBLIC_GATEWAY_URL=https://claw-ai.example.com`
  - `GATEWAY_AUTH_TOKEN=<gateway token>`
- OpenClaw or its gateway can call back into HiTechClaw AI with:
  - `GATEWAY_HOOKS_URL=https://ai.example.com/api/ingest`
  - `GATEWAY_HOOK_TOKEN=<hook token>`

Example sanitized configuration:

**OpenClaw `.env`**

```bash
OPENCLAW_VERSION=latest
OPENCLAW_GATEWAY_PORT=18789
OPENCLAW_GATEWAY_TOKEN=CHANGE_THIS_GATEWAY_TOKEN
OPENCLAW_MGMT_API_KEY=CHANGE_THIS_MGMT_API_KEY

DOMAIN=claw-ai.example.com

MC_INGEST_URL=https://ai.example.com/api/ingest
MC_AGENT_TOKEN=CHANGE_THIS_AGENT_TOKEN

ACME_EMAIL=you@example.com
NODE_OPTIONS=--max-old-space-size=7956
```

**HiTechClaw AI `.env.local`**

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

Recommended rollout order:

1. Rotate all secrets and tokens
2. Fix `MC_AGENT_TOKENS` to `agent-id:token` format
3. Point `MC_INGEST_URL` and `telemetry.endpoint` to the public HiTechClaw AI URL
4. Restart HiTechClaw AI
5. Restart OpenClaw or NemoClaw
6. Send a manual ingest test with `event_type`

### Reset everything

```bash
docker compose down -v  # removes containers AND database volume
docker compose up -d    # fresh start
```

---

## Upgrading

```bash
git pull origin main
docker compose build
docker compose up -d
```

Migrations run automatically on startup. Your data is preserved in the database volume.

---

## Production Deployment

For production use:

1. **Use a strong `MC_ADMIN_TOKEN`** — this is your login password
2. **Generate a real `NEXTAUTH_SECRET`** — `openssl rand -base64 32`
3. **Put HiTechClaw AI behind a reverse proxy** (Nginx, Caddy, Traefik) with TLS
4. **Set `HITECHCLAW_AI_BASE_URL`** to your public HTTPS URL
5. **Back up the database** — schedule `pg_dump` via cron
6. **Monitor disk usage** — TimescaleDB hypertables grow with event volume

Example Nginx config:

```nginx
server {
    listen 443 ssl;
    server_name hitechclaw.ai.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/hitechclaw.ai.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/hitechclaw.ai.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;  # Must match the PORT in your .env / ecosystem.config.js
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
