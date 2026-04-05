$ErrorActionPreference = 'Stop'

$env:PLAYWRIGHT_SKIP_WEBSERVER = '0'

Write-Host '[test-e2e-ci-local] Resetting test database to a clean state...'
& pwsh -ExecutionPolicy Bypass -File ./scripts/test-db-up.ps1 -Reset
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

Write-Host '[test-e2e-ci-local] Running Playwright in CI-like mode...'
& node --env-file=.env.test.local ./node_modules/@playwright/test/cli.js test --workers=1
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}
