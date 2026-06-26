$ErrorActionPreference = 'Continue'
$env:NODE_ENV = 'production'
$env:GRADLE_USER_HOME = 'C:\g'
Set-Location 'C:\b\android'
$localMaven = 'C:\b\android\local-maven'

function Save-MavenArtifact {
  param([string]$GroupId, [string]$ArtifactId, [string]$Version, [string]$FileName)
  $Version = ($Version -replace '\s', '').Trim()
  $groupPath = ($GroupId -replace '\.', '/')
  $destDir = Join-Path $localMaven "$groupPath/$ArtifactId/$Version"
  New-Item -ItemType Directory -Force -Path $destDir | Out-Null
  foreach ($file in @($FileName, "$ArtifactId-$Version.pom")) {
    $dest = Join-Path $destDir $file
    if (Test-Path $dest) { continue }
    foreach ($base in @('https://dl.google.com/dl/android/maven2', 'https://repo1.maven.org/maven2')) {
      curl.exe --ssl-no-revoke -fsSL "$base/$groupPath/$ArtifactId/$Version/$file" -o $dest 2>$null
      if (Test-Path $dest) { break }
    }
  }
}

$extras = @(
  @{ g='androidx.emoji2'; a='emoji2'; v='1.4.0'; f='emoji2-1.4.0.aar' },
  @{ g='androidx.emoji2'; a='emoji2-views-helper'; v='1.4.0'; f='emoji2-views-helper-1.4.0.aar' },
  @{ g='androidx.tracing'; a='tracing'; v='1.2.0'; f='tracing-1.2.0.aar' },
  @{ g='androidx.lifecycle'; a='lifecycle-viewmodel-savedstate-android'; v='2.9.0'; f='lifecycle-viewmodel-savedstate-android-2.9.0.aar' }
)
foreach ($item in $extras) {
  Save-MavenArtifact -GroupId $item.g -ArtifactId $item.a -Version $item.v -FileName $item.f
}

$buildOk = $false
for ($i = 1; $i -le 40; $i++) {
  Write-Host "GRADLE ATTEMPT $i"
  $log = "C:\b\gradle-attempt-$i.txt"
  .\gradlew.bat assembleRelease 2>&1 | Tee-Object $log
  $text = ((Get-Content $log -Encoding UTF8) -join ' ')
  if ($text -match 'BUILD SUCCESSFUL') { $buildOk = $true; break }
  $matches = [regex]::Matches($text, 'Could not download ([^\s]+\.(?:aar|jar)) \(([^:]+):([^:]+):([^)]+)\)')
  if ($matches.Count -eq 0) { break }
  $seen = @{}
  foreach ($match in $matches) {
    $key = "$($match.Groups[2].Value):$($match.Groups[3].Value):$($match.Groups[4].Value)"
    if ($seen.ContainsKey($key)) { continue }
    $seen[$key] = $true
    Write-Host "Fetching $key"
    Save-MavenArtifact -GroupId $match.Groups[2].Value -ArtifactId $match.Groups[3].Value -Version $match.Groups[4].Value -FileName $match.Groups[1].Value
  }
}

$apk = 'C:\b\android\app\build\outputs\apk\release\app-release.apk'
if ($buildOk -and (Test-Path $apk)) {
  Copy-Item $apk 'C:\Users\user\Desktop\MyAssistant172.apk' -Force
  Write-Host 'KLAR 172'
} else {
  Write-Host 'MISSLYCKAD'
}
