param(
  [string]$ImageRef = 'ghcr.io/thanhan92-f1/hitechclaw-ai:latest',
  [Alias('Issuer')]
  [string]$CertificateOidcIssuer = 'https://token.actions.githubusercontent.com',
  [Alias('Identity', 'WorkflowIdentity')]
  [string]$CertificateIdentityRegexp = 'https://github.com/thanhan92-f1/hitechclaw-ai/.github/workflows/(docker-publish|release)\.yml@.*',
  [ValidateSet('text', 'json')]
  [string]$OutputMode = 'text'
)

$ErrorActionPreference = 'Stop'

function Invoke-CosignCheck {
  param(
    [string]$StepName,
    [string[]]$Arguments
  )

  $commandOutput = & cosign @Arguments 2>&1
  $exitCode = $LASTEXITCODE
  $outputLines = @($commandOutput | ForEach-Object { $_.ToString() })

  if ($OutputMode -eq 'text') {
    Write-Host "[verify-ghcr-image] $StepName for $ImageRef"
    foreach ($line in $outputLines) {
      Write-Host $line
    }
  }

  if ($exitCode -ne 0) {
    if ($OutputMode -eq 'json') {
      $failurePayload = [ordered]@{
        imageRef = $ImageRef
        certificateOidcIssuer = $CertificateOidcIssuer
        certificateIdentityRegexp = $CertificateIdentityRegexp
        outputMode = $OutputMode
        success = $false
        failedStep = $StepName
        output = $outputLines
      }

      $failurePayload | ConvertTo-Json -Depth 6
    }

    exit $exitCode
  }

  return [ordered]@{
    step = $StepName
    success = $true
    output = $outputLines
  }
}

if (-not (Get-Command cosign -ErrorAction SilentlyContinue)) {
  Write-Error 'cosign was not found in PATH. Install Cosign first, then rerun this script.'
}

if ($args.Count -gt 0 -and -not [string]::IsNullOrWhiteSpace($args[0])) {
  $ImageRef = $args[0]
}

$results = @()

$results += Invoke-CosignCheck -StepName 'Verifying signature' -Arguments @(
  'verify',
  $ImageRef,
  '--certificate-oidc-issuer',
  $CertificateOidcIssuer,
  '--certificate-identity-regexp',
  $CertificateIdentityRegexp
)

$results += Invoke-CosignCheck -StepName 'Verifying SLSA provenance attestation' -Arguments @(
  'verify-attestation',
  $ImageRef,
  '--type',
  'slsaprovenance',
  '--certificate-oidc-issuer',
  $CertificateOidcIssuer,
  '--certificate-identity-regexp',
  $CertificateIdentityRegexp
)

$results += Invoke-CosignCheck -StepName 'Verifying SPDX SBOM attestation' -Arguments @(
  'verify-attestation',
  $ImageRef,
  '--type',
  'spdxjson',
  '--certificate-oidc-issuer',
  $CertificateOidcIssuer,
  '--certificate-identity-regexp',
  $CertificateIdentityRegexp
)

if ($OutputMode -eq 'json') {
  [ordered]@{
    imageRef = $ImageRef
    certificateOidcIssuer = $CertificateOidcIssuer
    certificateIdentityRegexp = $CertificateIdentityRegexp
    outputMode = $OutputMode
    success = $true
    checks = $results
  } | ConvertTo-Json -Depth 6
}
else {
  Write-Host '[verify-ghcr-image] Signature and attestation verification passed.'
}
