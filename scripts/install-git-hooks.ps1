$ErrorActionPreference = 'Stop'

$repoRoot = (Get-Location).Path
$hooksPath = Join-Path $repoRoot '.githooks'
$prePush = Join-Path $hooksPath 'pre-push'

if (-not (Test-Path $prePush)) {
  throw "Missing hook template: $prePush"
}

Write-Host '[install-git-hooks] Configuring Git hooks path...'
git config core.hooksPath .githooks

Write-Host '[install-git-hooks] Git hooks path set to .githooks'
Write-Host '[install-git-hooks] Pre-push hook is now active for this clone.'
