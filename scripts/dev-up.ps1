param(
  [switch]$Reset
)

$ErrorActionPreference = 'Stop'

$composeFile = 'docker-compose.dev.yml'
$envFile = '.env.local'

if (-not (Test-Path $envFile)) {
  throw "Missing $envFile. Copy .env.development.example to .env.local first."
}

if ($Reset) {
  docker compose -f $composeFile --env-file $envFile down -v
}

Write-Host '[dev-up] Starting local development database...'
docker compose -f $composeFile --env-file $envFile up -d
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

Write-Host '[dev-up] Running local migrations...'
node --env-file=$envFile ./node_modules/tsx/dist/cli.mjs scripts/migrate.ts
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

Write-Host '[dev-up] Ready. Start the app with: npm run dev'
