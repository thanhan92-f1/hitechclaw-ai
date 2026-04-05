$ErrorActionPreference = 'Stop'

$composeFile = 'docker-compose.dev.yml'
$envFile = '.env.local'

if (-not (Test-Path $envFile)) {
  throw "Missing $envFile."
}

Write-Host '[dev-down] Stopping local development database...'
docker compose -f $composeFile --env-file $envFile down
