$ErrorActionPreference = 'Stop'

Write-Host '[clean-all] Cleaning development stack...'
if (Test-Path '.env.local') {
  & pwsh -ExecutionPolicy Bypass -File ./scripts/dev-clean.ps1
}

Write-Host '[clean-all] Cleaning test stack...'
if (Test-Path '.env.test.local') {
  & pwsh -ExecutionPolicy Bypass -File ./scripts/test-clean.ps1
}

Write-Host '[clean-all] Removing local generated artifacts...'
$paths = @(
  '.next',
  'playwright-report',
  'test-results',
  'coverage'
)

foreach ($path in $paths) {
  if (Test-Path $path) {
    Remove-Item -Recurse -Force $path
    Write-Host "[clean-all] Removed $path"
  }
}

Write-Host '[clean-all] Done.'
