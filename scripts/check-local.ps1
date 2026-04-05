$ErrorActionPreference = 'Stop'

Write-Host '[check-local] Starting development database and migrations...'
& pwsh -ExecutionPolicy Bypass -File ./scripts/dev-up.ps1

Write-Host '[check-local] Starting test database and migrations...'
& pwsh -ExecutionPolicy Bypass -File ./scripts/test-db-up.ps1

Write-Host '[check-local] Running lint...'
& npm run lint
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

Write-Host '[check-local] Running managed smoke tests...'
& npm run test:smoke:managed
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

Write-Host '[check-local] All local checks passed.'
