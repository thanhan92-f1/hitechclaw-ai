$PlaywrightChoices = @(
  'test:smoke:managed',
  'test:e2e:managed',
  'test:e2e:api',
  'test:e2e:ui',
  'test:e2e:mobile',
  'test:e2e:edge'
)

param(
  [ValidateSet('test:smoke:managed', 'test:e2e:managed', 'test:e2e:api', 'test:e2e:ui', 'test:e2e:mobile', 'test:e2e:edge')]
  [string]$PlaywrightCommand = 'test:smoke:managed'
)

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

Write-Host "[check-local] Running Playwright command: npm run $PlaywrightCommand"
& npm run $PlaywrightCommand
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

Write-Host '[check-local] All local checks passed.'
