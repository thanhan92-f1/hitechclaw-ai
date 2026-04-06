param(
  [ValidateSet('check:local', 'check:local:api', 'check:local:ui', 'check:local:mobile', 'check:local:edge')]
  [string]$BaselineCommand = 'check:local',

  [ValidateSet('test:e2e:ci-local', 'test:e2e:managed', 'test:e2e:api', 'test:e2e:ui', 'test:e2e:mobile', 'test:e2e:edge')]
  [string]$VerificationCommand = 'test:e2e:ci-local'
)

$ErrorActionPreference = 'Stop'

Write-Host "[pre-push-check] Running local baseline checks via: npm run $BaselineCommand"
& npm run $BaselineCommand
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

Write-Host "[pre-push-check] Running Playwright verification via: npm run $VerificationCommand"
& npm run $VerificationCommand
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

Write-Host '[pre-push-check] Pre-push checks passed.'
