param(
  [switch]$Reset
)

$ErrorActionPreference = 'Stop'

$composeFile = 'docker-compose.test.yml'
$envFile = '.env.test.local'

if (-not (Test-Path $envFile)) {
  throw "Missing $envFile. Copy .env.test.example to .env.test.local first."
}

if ($Reset) {
  docker compose -f $composeFile --env-file $envFile down -v
}

Write-Host '[test-db-up] Starting local test database...'
docker compose -f $composeFile --env-file $envFile up -d
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

Write-Host '[test-db-up] Running test migrations...'
node --env-file=$envFile ./node_modules/tsx/dist/cli.mjs scripts/migrate.ts
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

Write-Host '[test-db-up] Ready for Playwright or local integration tests.'
