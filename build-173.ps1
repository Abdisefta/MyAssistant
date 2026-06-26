$ErrorActionPreference = 'Continue'
robocopy 'C:\Users\user\My-assistent\MyAssistant\MyAssistantFinal' 'C:\b' /E /XD node_modules android\app\build android\app\.cxx android\build android\.gradle /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
Set-Location 'C:\b'
npm ci
powershell -ExecutionPolicy Bypass -File 'C:\b\scripts\prefetch-exoplayer.ps1'
powershell -ExecutionPolicy Bypass -File 'C:\b\scripts\prefetch-android-minimal.ps1'
(Get-Content 'C:\b\android\gradle.properties') -replace 'newArchEnabled=false','newArchEnabled=true' | Set-Content 'C:\b\android\gradle.properties'
(Get-Content 'C:\b\android\app\build.gradle') -replace 'versionCode 18','versionCode 19' -replace 'versionName "1.7.2"','versionName "1.7.3"' | Set-Content 'C:\b\android\app\build.gradle'
(Get-Content 'C:\b\android\app\build.gradle') -replace 'versionCode 17','versionCode 19' -replace 'versionName "1.7.1"','versionName "1.7.3"' | Set-Content 'C:\b\android\app\build.gradle'
(Get-Content 'C:\b\android\app\build.gradle') -replace 'CMAKE_OBJECT_PATH_MAX=128','CMAKE_OBJECT_PATH_MAX=32' | Set-Content 'C:\b\android\app\build.gradle'
Remove-Item -Recurse -Force 'C:\b\android\build','C:\b\android\app\.cxx','C:\b\android\app\build' -ErrorAction SilentlyContinue
Get-ChildItem 'C:\b\node_modules' -Directory -Recurse -Filter '.cxx' -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
$env:NODE_ENV = 'production'
$env:GRADLE_USER_HOME = 'C:\g'
Set-Location 'C:\b\android'

function Save-MavenArtifact {
  param(
    [string]$GroupId,
    [string]$ArtifactId,
    [string]$Version,
    [string]$FileName
  )
  $Version = ($Version -replace '\s', '').Trim()
  if (-not $Version) { return }
  $groupPath = ($GroupId -replace '\.', '/')
  $destDir = "C:\b\android\local-maven\$groupPath\$ArtifactId\$Version"
  New-Item -ItemType Directory -Force -Path $destDir | Out-Null
  $ext = [System.IO.Path]::GetExtension($FileName)
  if ($ext -eq '.aar' -or $ext -eq '.jar') {
    $artifactPath = Join-Path $destDir $FileName
    if (-not (Test-Path $artifactPath)) {
      foreach ($base in @('https://dl.google.com/dl/android/maven2', 'https://repo1.maven.org/maven2')) {
        curl.exe --ssl-no-revoke -fsSL "$base/$groupPath/$ArtifactId/$Version/$FileName" -o $artifactPath 2>$null
        if (Test-Path $artifactPath) { break }
      }
    }
  }
  $pomName = "$ArtifactId-$Version.pom"
  $pomPath = Join-Path $destDir $pomName
  if (-not (Test-Path $pomPath)) {
    foreach ($base in @('https://dl.google.com/dl/android/maven2', 'https://repo1.maven.org/maven2')) {
      curl.exe --ssl-no-revoke -fsSL "$base/$groupPath/$ArtifactId/$Version/$pomName" -o $pomPath 2>$null
      if (Test-Path $pomPath) { break }
    }
  }
}

$logPath = 'C:\b\build-173.log'
Set-Content -Path $logPath -Value "BUILD 173 START $(Get-Date -Format o)"
$buildOk = $false
for ($attempt = 1; $attempt -le 40; $attempt++) {
  "BUILD ATTEMPT $attempt" | Add-Content $logPath
  $attemptLog = "C:\b\build-173-attempt-$attempt.txt"
  .\gradlew.bat assembleRelease 2>&1 | Tee-Object -FilePath $attemptLog
  Get-Content $attemptLog | Add-Content $logPath
  $log = ((Get-Content $attemptLog -Encoding UTF8) -join ' ')
  if ($log -match 'BUILD SUCCESSFUL') {
    $buildOk = $true
    break
  }
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
  Copy-Item $apk 'C:\Users\user\Desktop\MyAssistant173.apk' -Force
  'KLAR 173' | Add-Content $logPath
} else {
  'MISSLYCKAD' | Add-Content $logPath
}
