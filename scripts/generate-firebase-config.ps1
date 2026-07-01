$ErrorActionPreference = 'Stop'
$root = 'C:\Users\user\My-assistent\MyAssistant\MyAssistantFinal'
$envFile = Join-Path $root '.env'
$outFile = Join-Path $root 'constants\firebase.generated.ts'
$geminiOut = Join-Path $root 'constants\gemini.generated.ts'

if (-not (Test-Path $envFile)) {
  Write-Host 'Ingen .env â€” hoppar over firebase.generated.ts'
  exit 0
}

$vars = @{}
Get-Content $envFile | ForEach-Object {
  if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
    $vars[$matches[1]] = $matches[2].Trim().Trim('"').Trim("'")
  }
}

function Get-Var([string]$name) {
  if ($vars.ContainsKey($name)) { return $vars[$name] }
  return ''
}

$content = @"
/** Auto-generated from .env at build time â€” do not edit manually. */
export const FIREBASE_BUILD_CONFIG = {
  apiKey: '$(Get-Var 'EXPO_PUBLIC_FIREBASE_API_KEY')',
  androidApiKey: '$(Get-Var 'EXPO_PUBLIC_FIREBASE_ANDROID_API_KEY')',
  authDomain: '$(Get-Var 'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN')',
  projectId: '$(Get-Var 'EXPO_PUBLIC_FIREBASE_PROJECT_ID')',
  storageBucket: '$(Get-Var 'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET')',
  messagingSenderId: '$(Get-Var 'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID')',
  appId: '$(Get-Var 'EXPO_PUBLIC_FIREBASE_APP_ID')',
};

"@

Set-Content -Path $outFile -Value $content -Encoding UTF8
Write-Host "Skrev $outFile"

$geminiKey = Get-Var 'EXPO_PUBLIC_GEMINI_API_KEY'
$bakedGemini = ''
if ($geminiKey -match '^AIzaSy') { $bakedGemini = $geminiKey }

$geminiContent = @"
/** Auto-generated from .env at build time â€” only AIzaSy keys are baked in. */
export const GEMINI_BUILD_CONFIG = {
  apiKey: '$bakedGemini',
};

"@

Set-Content -Path $geminiOut -Value $geminiContent -Encoding UTF8
if ($bakedGemini) {
  Write-Host "Skrev $geminiOut (AIzaSy)"
} elseif ($geminiKey) {
  Write-Host "VARNING: EXPO_PUBLIC_GEMINI_API_KEY ar AQ - behover AIzaSy fran Google Cloud"
} else {
  Write-Host "Skrev $geminiOut (tom - lagg till EXPO_PUBLIC_GEMINI_API_KEY)"
}
