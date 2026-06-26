# Push alla EXPO_PUBLIC_* fran .env till EAS preview-miljon.
# Kor fran projektroten: .\scripts\push-eas-env.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$envFile = Join-Path $root ".env"

if (-not (Test-Path $envFile)) {
  Write-Host "Saknar .env - kopiera fran .env.example forst." -ForegroundColor Red
  exit 1
}

$vars = Get-Content $envFile | Where-Object {
  $_ -match '^\s*EXPO_PUBLIC_' -and $_ -notmatch '^\s*#'
}

if (-not $vars) {
  Write-Host "Inga EXPO_PUBLIC_* i .env." -ForegroundColor Yellow
  exit 0
}

Push-Location $root
Write-Host "Pushar $($vars.Count) variabler till EAS (preview)..." -ForegroundColor Cyan

foreach ($line in $vars) {
  if ($line -notmatch '^\s*([^=]+)=(.*)$') { continue }
  $name = $matches[1].Trim()
  $value = $matches[2].Trim()
  if (-not $value) {
    Write-Host "  Hoppar over $name (tom)" -ForegroundColor DarkGray
    continue
  }
  Write-Host "  $name" -ForegroundColor Green
  npx eas-cli env:create --name $name --value $value --environment preview --visibility plaintext --force --non-interactive
}

Write-Host "Klart. Bygg om med: npx eas-cli build --platform android --profile preview" -ForegroundColor Cyan
Pop-Location
