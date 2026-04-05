$ErrorActionPreference = 'Stop'

$composeFile = 'docker-compose.test.yml'
$envFile = '.env.test.local'

if (-not (Test-Path $envFile)) {
  throw "Missing $envFile."
}

Write-Host '[test-db-down] Stopping local test database...'
docker compose -f $composeFile --env-file $envFile down
