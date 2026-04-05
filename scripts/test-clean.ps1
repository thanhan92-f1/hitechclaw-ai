$ErrorActionPreference = 'Stop'

$composeFile = 'docker-compose.test.yml'
$envFile = '.env.test.local'

if (-not (Test-Path $envFile)) {
  throw "Missing $envFile."
}

Write-Host '[test-clean] Removing test database containers and volume...'
docker compose -f $composeFile --env-file $envFile down -v --remove-orphans
