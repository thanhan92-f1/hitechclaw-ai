# Local Development Guide

This workflow runs only TimescaleDB in Docker. The Next.js application, migrations, linting, and tests run directly on the host machine for faster iteration.

## Dev Files

- `docker-compose.dev.yml` — development-only Docker Compose file with just the database.
- `.env.development.example` — tracked template for local development variables.
- `.env.local` — your untracked local environment file used by Next.js and local scripts.

## Prerequisites

- Node.js 25+
- npm 10+
- Docker Desktop / Docker Engine with Compose v2

## 1. Create the Local Environment File

Use the development template:

```powershell
Copy-Item .env.development.example .env.local
```

Minimum values to change before real team usage:

- `MC_ADMIN_TOKEN`
- `MC_AGENT_TOKENS`
- `NEXTAUTH_SECRET`

## 2. Start Only the Database Container

```powershell
npm run dev:up
```

Equivalent low-level command:

```powershell
npm run dev:db:up
```

This starts:

- `db` on `127.0.0.1:${DB_PORT}`

To stop it:

```powershell
npm run dev:down
```

Or:

```powershell
npm run dev:db:down
```

To reset the development database volume:

```powershell
npm run dev:reset
```

To fully clean the development stack volume:

```powershell
npm run dev:clean
```

To clean dev, test, and generated local artifacts together:

```powershell
npm run clean:all
```

Or:

```powershell
npm run dev:db:reset
```

To follow database logs:

```powershell
npm run dev:db:logs
```

## 3. Run Migrations Locally

```powershell
npm run db:migrate:dev
```

Or run the full first-time setup:

```powershell
npm run dev:setup
```

## 4. Start the App Locally

```powershell
npm run dev
```

Open `http://localhost:3000`.

## Development Notes

- `next dev` automatically reads `.env.local`.
- `db:migrate:dev` explicitly loads `.env.local` so migrations use the same local database settings.
- `docker-compose.dev.yml` isolates dev database data in the `pgdata_dev` volume.
- Keep `.env.local` untracked; commit only `.env.development.example` updates.

## Suggested Local Workflow

1. `Copy-Item .env.development.example .env.local`
2. `npm install`
3. `npm run dev:db:up`
4. `npm run db:migrate:dev`
5. `npm run dev`

## Troubleshooting

### Port 5432 already used

Set a different `DB_PORT` in `.env.local`, then update `DATABASE_URL` to match.

Example:

```env
DB_PORT=55432
DATABASE_URL=postgresql://hitechclaw-ai:hitechclaw-ai@127.0.0.1:55432/hitechclaw-ai
```

### Database connection errors

Check the container status and logs:

```powershell
docker compose -f docker-compose.dev.yml --env-file .env.local ps
docker compose -f docker-compose.dev.yml --env-file .env.local logs db
```

### Need a clean database

```powershell
npm run dev:db:reset
npm run db:migrate:dev
```

## Local E2E / Playwright Database Profile

For isolated browser testing, use the dedicated test database stack.

### Test files

- `docker-compose.test.yml` — dedicated database container for Playwright or local integration testing.
- `.env.test.example` — tracked template for test settings.
- `.env.test.local` — your untracked local test environment file.

### Create the test environment file

```powershell
Copy-Item .env.test.example .env.test.local
```

### Start the test database

```powershell
npm run test:db:up
```

### Run test migrations

```powershell
npm run db:migrate:test
```

Or run both in one step:

```powershell
npm run test:setup
```

### Test profile defaults

- App URL: `http://localhost:3001`
- Database port: `55432`
- Database volume: `pgdata_test`

### Stop or reset the test database

```powershell
npm run test:db:down
npm run test:db:reset
```

To fully clean the test stack volume:

```powershell
npm run test:clean
```

### Run local Playwright end-to-end tests

This command will:

1. ensure the test database is up,
2. run test migrations,
3. start the app on port `3001`,
4. wait for readiness,
5. execute Playwright,
6. stop the temporary app process.

```powershell
npm run test:e2e:local
```

Smoke-only run:

```powershell
npm run test:smoke:local
```

### Run managed Playwright mode

If the test database is already prepared, Playwright can manage the app process itself through `webServer`:

```powershell
npm run test:setup
npm run test:e2e:managed
```

Targeted categorized runs:

```powershell
npm run test:e2e:api
npm run test:e2e:ui
npm run test:e2e:mobile
npm run test:e2e:edge
```

Smoke-only:

```powershell
npm run test:smoke:managed
```

### Run CI-like local Playwright mode

This mode resets the test database, reruns migrations, disables Playwright server reuse, and executes the full suite in a cleaner local approximation of CI:

```powershell
npm run test:e2e:ci-local
```

### Run all local checks

Run database startup, migrations, lint, and smoke tests in one flow:

```powershell
npm run check:local
```

Focused local slices:

```powershell
npm run check:local:api
npm run check:local:ui
npm run check:local:mobile
npm run check:local:edge
```

### Run the pre-push local gate

Run a stronger local verification pass before pushing:

```powershell
npm run check:pre-push
```

Focused pre-push variants are also available when you are only touching one suite slice:

```powershell
npm run check:pre-push:api
npm run check:pre-push:ui
npm run check:pre-push:mobile
npm run check:pre-push:edge
```

This runs:

1. `npm run check:local`
2. `npm run test:e2e:ci-local`

Focused variants swap those commands for the matching categorized suite commands.

### Install the git hook template

To wire the repository's tracked pre-push hook into your local Git config:

```powershell
npm run hooks:install
```

This sets `core.hooksPath` to `.githooks` for the current clone.

The tracked pre-push hook runs `npm run check:pre-push` by default. For temporary local focus on one categorized slice, set `HITECHCLAW_PRE_PUSH_COMMAND` before pushing, for example:

```powershell
$env:HITECHCLAW_PRE_PUSH_COMMAND = 'check:pre-push:api'
git push
```

Supported values:

- `check:pre-push`
- `check:pre-push:api`
- `check:pre-push:ui`
- `check:pre-push:mobile`
- `check:pre-push:edge`

### Test token compatibility

Playwright auth helpers now accept either `MC_AGENT_TOKEN` or the standard `MC_AGENT_TOKENS` format.

### Playwright env loading

`playwright.config.ts` now auto-loads `.env.test.local` first and falls back to `.env.local`, without overriding variables already provided by the shell or CI.

### Categorized Playwright suite

The end-to-end suite is organized into focused directories instead of keeping all specs at the root:

- `tests/api` — API contracts, ingest, auth, audit, dashboards, workflows, and service endpoints
- `tests/ui` — desktop UI flows, route smoke checks, settings, help, and operational dashboards
- `tests/mobile` — mobile viewport and shell behavior
- `tests/setup` — setup wizard coverage and auth bootstrap state generation
- `tests/edge` — high-risk edge scenarios such as tenant isolation
- `tests/helpers` — shared auth, session, route, and page error helpers

Notes:

- `npm run test:e2e:managed` still runs the full categorized suite.
- `npm run test:e2e:mobile` pins execution to the `chromium-mobile` project for the mobile-only folder.
- The `setup` Playwright project generates `tests/.auth/admin.json` before dependent browser projects run.
- GitHub Actions smoke coverage runs `@smoke` on `chromium-desktop`.
- GitHub Actions categorized regression fans out `tests/api`, `tests/ui`, `tests/mobile`, and `tests/edge` into separate jobs for clearer failure isolation.
- Scheduled or manual cross-browser regression runs `tests/ui` on `chromium-desktop`, `firefox-desktop`, and `webkit-desktop`.
- Docs-only and other non-runtime changes skip the heavier CI jobs through path-based filtering in `.github/workflows/ci.yml`.
- A lightweight docs/governance job still runs on every CI trigger, verifies core repository guidance files exist, and writes a CI scope summary to the job summary.
- Automation-only changes such as `.github/workflows/**`, `.githooks/**`, or `scripts/**` run lint/build plus smoke coverage, but intentionally skip the broader categorized regression jobs.
