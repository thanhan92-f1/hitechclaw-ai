$ErrorActionPreference = 'Stop'

Write-Host '[pre-push-check] Running local baseline checks...'
& npm run check:local
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

Write-Host '[pre-push-check] Running CI-like Playwright verification...'
& npm run test:e2e:ci-local
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

Write-Host '[pre-push-check] Pre-push checks passed.'
