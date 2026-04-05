param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$PlaywrightArgs
)

$ErrorActionPreference = 'Stop'

$envFile = '.env.test.local'
if (-not (Test-Path $envFile)) {
  throw "Missing $envFile. Copy .env.test.example to .env.test.local first."
}

$envMap = @{}
Get-Content $envFile | ForEach-Object {
  $line = $_.Trim()
  if (-not $line -or $line.StartsWith('#')) { return }

  $parts = $line -split '=', 2
  if ($parts.Length -ne 2) { return }

  $key = $parts[0].Trim()
  $value = $parts[1].Trim()
  $envMap[$key] = $value
}

Write-Host '[test-e2e-local] Preparing test database...'
& pwsh -ExecutionPolicy Bypass -File ./scripts/test-db-up.ps1

$port = if ($envMap.ContainsKey('PORT')) { $envMap['PORT'] } else { '3001' }
$baseUrl = if ($envMap.ContainsKey('HITECHCLAW_AI_BASE_URL')) { $envMap['HITECHCLAW_AI_BASE_URL'] } else { "http://localhost:$port" }

Write-Host "[test-e2e-local] Starting app on $baseUrl ..."
$job = Start-Job -ScriptBlock {
  param($workingDir)
  Set-Location $workingDir
  node --env-file=.env.test.local ./node_modules/next/dist/bin/next dev -p 3001
} -ArgumentList (Get-Location).Path

try {
  Write-Host '[test-e2e-local] Waiting for app readiness...'
  node --env-file=.env.test.local ./node_modules/wait-on/bin/wait-on $baseUrl

  Write-Host '[test-e2e-local] Running Playwright...'
  if ($PlaywrightArgs -and $PlaywrightArgs.Length -gt 0) {
    & npx playwright test @PlaywrightArgs
  } else {
    & npx playwright test
  }

  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
}
finally {
  Write-Host '[test-e2e-local] Stopping temporary app process...'
  Stop-Job -Job $job -ErrorAction SilentlyContinue | Out-Null
  Receive-Job -Job $job -Keep -ErrorAction SilentlyContinue | Out-String | Write-Host
  Remove-Job -Job $job -Force -ErrorAction SilentlyContinue | Out-Null
}
