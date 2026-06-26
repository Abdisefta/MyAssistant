# Testa Gemini-nyckel INNAN eas build
# Anvandning: .\scripts\test-gemini-key.ps1 -Key "AIzaSy..."

param(
  [Parameter(Mandatory = $true)]
  [string]$Key
)

$body = '{"contents":[{"parts":[{"text":"Sag bara: Hej"}]}]}'
$uri = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=$Key"

$preview = $Key.Substring(0, [Math]::Min(10, $Key.Length))
Write-Host "Testar nyckel som borjar med: $preview..." -ForegroundColor Cyan

try {
  $response = Invoke-RestMethod -Uri $uri -Method POST -ContentType "application/json" -Body $body
  $text = $response.candidates[0].content.parts[0].text
  Write-Host "OK - Gemini svarade:" -ForegroundColor Green
  Write-Host $text
  exit 0
}
catch {
  Write-Host "FEL - nyckeln funkar INTE:" -ForegroundColor Red
  Write-Host $_.Exception.Message
  if ($Key.StartsWith("AQ.")) {
    Write-Host ""
    Write-Host "AQ-nycklar fran AI Studio funkar ofta INTE i mobilappen." -ForegroundColor Yellow
    Write-Host "Skapa AIzaSy-nyckel i Google Cloud Console istallet." -ForegroundColor Yellow
  }
  exit 1
}
