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
npm run dev:db:up
```

This starts:

- `db` on `127.0.0.1:${DB_PORT}`

To stop it:

```powershell
npm run dev:db:down
```

To reset the development database volume:

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
