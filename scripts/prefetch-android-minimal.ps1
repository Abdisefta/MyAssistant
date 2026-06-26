# Download complete Maven coordinates (pom + binary) via curl — no partial poms.
param(
  [string]$OutDir = "$PSScriptRoot\..\android\local-maven"
)

$ErrorActionPreference = 'Continue'

function Get-GroupPath([string]$GroupId) { return ($GroupId -replace '\.', '/') }

function Download-Artifact {
  param(
    [string]$GroupId,
    [string]$ArtifactId,
    [string]$Version,
    [string]$Ext
  )
  $groupPath = Get-GroupPath $GroupId
  $destDir = Join-Path $OutDir "$groupPath/$ArtifactId/$Version"
  New-Item -ItemType Directory -Force -Path $destDir | Out-Null
  $fileName = "$ArtifactId-$Version.$Ext"
  $dest = Join-Path $destDir $fileName
  if (Test-Path $dest) { return $true }
  $bases = @('https://dl.google.com/dl/android/maven2', 'https://repo1.maven.org/maven2')
  foreach ($base in $bases) {
    $url = "$base/$groupPath/$ArtifactId/$Version/$fileName"
    curl.exe --ssl-no-revoke -fsSL $url -o $dest 2>$null
    if ((Test-Path $dest) -and ((Get-Item $dest).Length -gt 500)) { return $true }
    Remove-Item $dest -ErrorAction SilentlyContinue
  }
  return $false
}

$artifacts = @(
  @{ g='androidx.annotation'; a='annotation-jvm'; v='1.8.1'; e='jar' },
  @{ g='androidx.annotation'; a='annotation-jvm'; v='1.8.0'; e='jar' },
  @{ g='androidx.annotation'; a='annotation-jvm'; v='1.7.0'; e='jar' },
  @{ g='androidx.annotation'; a='annotation-experimental'; v='1.4.0'; e='aar' },
  @{ g='androidx.activity'; a='activity'; v='1.8.0'; e='aar' },
  @{ g='androidx.activity'; a='activity-ktx'; v='1.8.0'; e='aar' },
  @{ g='androidx.appcompat'; a='appcompat'; v='1.7.0'; e='aar' },
  @{ g='androidx.appcompat'; a='appcompat-resources'; v='1.7.0'; e='aar' },
  @{ g='androidx.core'; a='core'; v='1.13.1'; e='aar' },
  @{ g='androidx.core'; a='core-ktx'; v='1.13.1'; e='aar' },
  @{ g='androidx.lifecycle'; a='lifecycle-common'; v='2.8.7'; e='jar' },
  @{ g='androidx.lifecycle'; a='lifecycle-common-jvm'; v='2.8.7'; e='jar' },
  @{ g='androidx.lifecycle'; a='lifecycle-runtime'; v='2.8.7'; e='aar' },
  @{ g='androidx.lifecycle'; a='lifecycle-runtime-android'; v='2.8.7'; e='aar' },
  @{ g='androidx.lifecycle'; a='lifecycle-runtime-ktx'; v='2.8.7'; e='aar' },
  @{ g='androidx.lifecycle'; a='lifecycle-runtime-ktx-android'; v='2.8.7'; e='aar' },
  @{ g='androidx.lifecycle'; a='lifecycle-viewmodel'; v='2.8.7'; e='aar' },
  @{ g='androidx.lifecycle'; a='lifecycle-viewmodel-ktx'; v='2.8.7'; e='aar' },
  @{ g='androidx.lifecycle'; a='lifecycle-viewmodel-savedstate'; v='2.8.7'; e='aar' },
  @{ g='androidx.lifecycle'; a='lifecycle-livedata-core'; v='2.8.7'; e='aar' },
  @{ g='androidx.lifecycle'; a='lifecycle-livedata'; v='2.8.7'; e='aar' },
  @{ g='androidx.lifecycle'; a='lifecycle-viewmodel-savedstate'; v='2.6.2'; e='aar' },
  @{ g='com.vanniktech'; a='android-image-cropper'; v='4.6.0'; e='aar' },
  @{ g='host.exp.exponent'; a='expo.modules.imagepicker'; v='16.1.4'; e='aar' }
)

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$ok = 0
foreach ($item in $artifacts) {
  $pomOk = Download-Artifact -GroupId $item.g -ArtifactId $item.a -Version $item.v -Ext 'pom'
  $binOk = Download-Artifact -GroupId $item.g -ArtifactId $item.a -Version $item.v -Ext $item.e
  if ($pomOk -and $binOk) { $ok++ }
  Write-Host "$($item.g):$($item.a):$($item.v) pom=$pomOk bin=$binOk"
}
Write-Host "Done $ok/$($artifacts.Count) complete artifacts"
