$ErrorActionPreference = 'Stop'

$composeFile = 'docker-compose.dev.yml'
$envFile = '.env.local'

if (-not (Test-Path $envFile)) {
  throw "Missing $envFile."
}

Write-Host '[dev-clean] Removing development database containers and volume...'
docker compose -f $composeFile --env-file $envFile down -v --remove-orphans
