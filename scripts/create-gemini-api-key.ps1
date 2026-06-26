# Skapa Gemini API-nyckel via gcloud (om webben kranglar)
# Krav: gcloud CLI installerat + inloggad (gcloud auth login)
# Kor: .\scripts\create-gemini-api-key.ps1

$ErrorActionPreference = "Stop"
$project = "my-assistant-7f68b"

Write-Host "Projekt: $project" -ForegroundColor Cyan
Write-Host "Kontrollerar gcloud..." -ForegroundColor Cyan

$gcloud = Get-Command gcloud -ErrorAction SilentlyContinue
if (-not $gcloud) {
  Write-Host ""
  Write-Host "gcloud saknas. Installera Google Cloud SDK:" -ForegroundColor Yellow
  Write-Host "https://cloud.google.com/sdk/docs/install" -ForegroundColor Yellow
  Write-Host ""
  Write-Host "ELLER: klicka Show key pa Browser key och skicka nyckeln till agenten." -ForegroundColor Yellow
  exit 1
}

Write-Host "Aktiverar Generative Language API..." -ForegroundColor Cyan
gcloud services enable generativelanguage.googleapis.com --project=$project

Write-Host "Skapar API-nyckel..." -ForegroundColor Cyan
$result = gcloud services api-keys create `
  --display-name="MyAssistant Gemini" `
  --project=$project `
  --format="json" 2>&1

if ($LASTEXITCODE -ne 0) {
  Write-Host $result -ForegroundColor Red
  exit 1
}

$keyName = ($result | ConvertFrom-Json).name
Write-Host "Hamtar nyckelstrang..." -ForegroundColor Cyan
$keyData = gcloud services api-keys get-key-string $keyName --project=$project --format="json" | ConvertFrom-Json
$key = $keyData.keyString

Write-Host ""
Write-Host "NYCKEL (kopiera):" -ForegroundColor Green
Write-Host $key
Write-Host ""
Write-Host "Testa:" -ForegroundColor Cyan
Write-Host ".\scripts\test-gemini-key.ps1 -Key `"$key`""
