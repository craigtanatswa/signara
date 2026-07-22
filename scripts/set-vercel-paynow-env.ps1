# Sets Production + Preview env vars required for Paynow on signaraflow.com.
# Reads PAYNOW_* and RESEND_FROM_EMAIL from .env.local (does not commit secrets).
#
# Usage (from repo root, in your own PowerShell terminal):
#   .\scripts\set-vercel-paynow-env.ps1

$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')

if (-not (Test-Path '.env.local')) {
  throw '.env.local not found — needed for PAYNOW_INTEGRATION_ID / KEY'
}

function Get-DotEnvValue {
  param([string]$Key)
  $line = Get-Content '.env.local' | Where-Object { $_ -match "^\s*$Key\s*=" } | Select-Object -First 1
  if (-not $line) { return $null }
  return ($line -replace "^\s*$Key\s*=\s*", '').Trim().Trim('"').Trim("'")
}

$paynowId = Get-DotEnvValue 'PAYNOW_INTEGRATION_ID'
$paynowKey = Get-DotEnvValue 'PAYNOW_INTEGRATION_KEY'
$resendFrom = Get-DotEnvValue 'RESEND_FROM_EMAIL'
if (-not $resendFrom) { $resendFrom = 'Signara <noreply@signaraflow.com>' }
$appUrl = 'https://signaraflow.com'

if (-not $paynowId -or -not $paynowKey) {
  throw 'PAYNOW_INTEGRATION_ID and PAYNOW_INTEGRATION_KEY must be set in .env.local'
}

Write-Host 'Checking Vercel login...'
& npx --yes vercel@39.2.6 whoami 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Host ''
  Write-Host 'Not logged in. Starting GitHub out-of-band login...'
  Write-Host '1) Open the URL that appears'
  Write-Host '2) Paste the verification code when prompted'
  Write-Host ''
  & npx --yes vercel@39.2.6 login --github --oob
  if ($LASTEXITCODE -ne 0) { throw 'Vercel login failed' }
}

if (-not (Test-Path '.vercel\project.json')) {
  Write-Host 'Linking project (signara)...'
  & npx --yes vercel@39.2.6 link --yes --project signara
  if ($LASTEXITCODE -ne 0) { throw 'vercel link failed — pass --project <name> if your project slug differs' }
}

function Set-VercelEnv {
  param(
    [string]$Name,
    [string]$Value,
    [ValidateSet('production', 'preview', 'development')]
    [string]$Environment
  )

  Write-Host "Setting $Name ($Environment)..."
  & npx --yes vercel@39.2.6 env rm $Name $Environment --yes 2>$null | Out-Null
  $Value | & npx --yes vercel@39.2.6 env add $Name $Environment
  if ($LASTEXITCODE -ne 0) { throw "Failed to set $Name for $Environment" }
}

foreach ($envName in @('production', 'preview')) {
  Set-VercelEnv -Name 'NEXT_PUBLIC_APP_URL' -Value $appUrl -Environment $envName
  Set-VercelEnv -Name 'PAYNOW_INTEGRATION_ID' -Value $paynowId -Environment $envName
  Set-VercelEnv -Name 'PAYNOW_INTEGRATION_KEY' -Value $paynowKey -Environment $envName
  Set-VercelEnv -Name 'RESEND_FROM_EMAIL' -Value $resendFrom -Environment $envName
}

Write-Host ''
Write-Host 'Done. Redeploy production so the new env vars take effect:'
Write-Host '  npx vercel --prod'
Write-Host ''
