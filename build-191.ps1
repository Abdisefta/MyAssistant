$ErrorActionPreference = 'Continue'
powershell -ExecutionPolicy Bypass -File 'C:\Users\user\My-assistent\MyAssistant\MyAssistantFinal\scripts\generate-firebase-config.ps1'
robocopy 'C:\Users\user\My-assistent\MyAssistant\MyAssistantFinal' 'C:\b' /E /XD node_modules android\app\build android\app\.cxx android\build android\.gradle /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
Set-Location 'C:\b'
if (Test-Path 'C:\b\.env') {
  Get-Content 'C:\b\.env' | ForEach-Object {
    if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
      $name = $matches[1]
      $value = $matches[2].Trim().Trim('"').Trim("'")
      Set-Item -Path "Env:$name" -Value $value
    }
  }
}
npm ci
powershell -ExecutionPolicy Bypass -File 'C:\b\scripts\prefetch-exoplayer.ps1'
powershell -ExecutionPolicy Bypass -File 'C:\b\scripts\prefetch-android-minimal.ps1'
$xmlDir = 'C:\b\android\app\src\main\res\xml'
$xmlPath = Join-Path $xmlDir 'network_security_config.xml'
$manifestPath = 'C:\b\android\app\src\main\AndroidManifest.xml'
if (Test-Path $manifestPath) {
  New-Item -ItemType Directory -Force -Path $xmlDir | Out-Null
  @'
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <domain-config cleartextTrafficPermitted="true">
    <domain includeSubdomains="false">195.201.128.118</domain>
  </domain-config>
  <base-config cleartextTrafficPermitted="true" />
</network-security-config>
'@ | Set-Content -Path $xmlPath -Encoding UTF8
  $manifest = Get-Content $manifestPath -Raw
  if ($manifest -notmatch 'android:networkSecurityConfig') {
    $manifest = $manifest -replace '<application ', '<application android:networkSecurityConfig="@xml/network_security_config" android:usesCleartextTraffic="true" '
  } elseif ($manifest -notmatch 'android:usesCleartextTraffic="true"') {
    $manifest = $manifest -replace '<application ', '<application android:usesCleartextTraffic="true" '
  }
  Set-Content -Path $manifestPath -Value $manifest -Encoding UTF8
}
(Get-Content 'C:\b\android\gradle.properties') -replace 'newArchEnabled=false','newArchEnabled=true' | Set-Content 'C:\b\android\gradle.properties'
$gradle = Get-Content 'C:\b\android\app\build.gradle' -Raw
$gradle = $gradle -replace 'versionCode\s+\d+', 'versionCode 37'
$gradle = $gradle -replace 'versionName\s+"[^"]+"', 'versionName "1.9.1"'
Set-Content 'C:\b\android\app\build.gradle' -Value $gradle -Encoding UTF8
(Get-Content 'C:\b\android\app\build.gradle') -replace 'CMAKE_OBJECT_PATH_MAX=128','CMAKE_OBJECT_PATH_MAX=32' | Set-Content 'C:\b\android\app\build.gradle'
Remove-Item -Recurse -Force 'C:\b\android\build','C:\b\android\app\.cxx','C:\b\android\app\build' -ErrorAction SilentlyContinue
$env:NODE_ENV = 'production'
$env:EXPO_PUBLIC_ALMA_TTS_URL = 'http://195.201.128.118:3001'
if (-not $env:EXPO_PUBLIC_ANALYTICS_URL) { $env:EXPO_PUBLIC_ANALYTICS_URL = 'http://195.201.128.118:3002' }
if (-not $env:EXPO_PUBLIC_ANALYTICS_API_KEY) { $env:EXPO_PUBLIC_ANALYTICS_API_KEY = 'myassistant-analytics-key' }
$env:GRADLE_USER_HOME = 'C:\g'
Set-Location 'C:\b\android'

function Save-MavenArtifact {
  param([string]$GroupId,[string]$ArtifactId,[string]$Version,[string]$FileName)
  $Version = ($Version -replace '\s', '').Trim()
  if (-not $Version) { return }
  $groupPath = ($GroupId -replace '\.', '/')
  $destDir = "C:\b\android\local-maven\$groupPath\$ArtifactId\$Version"
  New-Item -ItemType Directory -Force -Path $destDir | Out-Null
  $artifactPath = Join-Path $destDir $FileName
  if (-not (Test-Path $artifactPath)) {
    foreach ($base in @('https://dl.google.com/dl/android/maven2', 'https://repo1.maven.org/maven2')) {
      curl.exe --ssl-no-revoke -fsSL "$base/$groupPath/$ArtifactId/$Version/$FileName" -o $artifactPath 2>$null
      if (Test-Path $artifactPath) { break }
    }
  }
}

$logPath = 'C:\b\build-191.log'
Set-Content -Path $logPath -Value "BUILD 191 START $(Get-Date -Format o)"
$buildOk = $false
for ($attempt = 1; $attempt -le 40; $attempt++) {
  "BUILD ATTEMPT $attempt" | Add-Content $logPath
  $attemptLog = "C:\b\build-191-attempt-$attempt.txt"
  .\gradlew.bat assembleRelease 2>&1 | Tee-Object -FilePath $attemptLog
  $log = ((Get-Content $attemptLog -Encoding UTF8) -join ' ')
  if ($log -match 'BUILD SUCCESSFUL') { $buildOk = $true; break }
  $matches = [regex]::Matches($log, 'Could not download ([^\s]+\.(?:aar|jar)) \(([^:]+):([^:]+):([^)]+)\)')
  if ($matches.Count -eq 0) { break }
  $seen = @{}
  foreach ($match in $matches) {
    $key = "$($match.Groups[2].Value):$($match.Groups[3].Value):$($match.Groups[4].Value)"
    if ($seen.ContainsKey($key)) { continue }
    $seen[$key] = $true
    Save-MavenArtifact -GroupId $match.Groups[2].Value -ArtifactId $match.Groups[3].Value -Version $match.Groups[4].Value -FileName $match.Groups[1].Value
  }
}

$apk = 'C:\b\android\app\build\outputs\apk\release\app-release.apk'
if ($buildOk -and (Test-Path $apk)) {
  Copy-Item $apk 'C:\Users\user\Desktop\MyAssistant191.apk' -Force
  Write-Host 'KLAR: C:\Users\user\Desktop\MyAssistant191.apk'
} else {
  Write-Host 'BYGG MISSLYCKADES â€” se C:\b\build-191.log'
}



