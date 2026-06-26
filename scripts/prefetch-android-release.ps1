# Prefetch Android release deps when Gradle SSL fails (curl + local-maven).
param(
  [string]$OutDir = "$PSScriptRoot\..\android\local-maven"
)

$ErrorActionPreference = 'Continue'
$visited = @{}
$queue = [System.Collections.Queue]::new()

function Get-GroupPath([string]$GroupId) {
  return ($GroupId -replace '\.', '/')
}

function Get-RepoBases([string]$GroupId) {
  $bases = @('https://repo1.maven.org/maven2')
  if ($GroupId.StartsWith('com.google.android') -or $GroupId.StartsWith('androidx.') -or $GroupId.StartsWith('com.android.')) {
    $bases = @('https://dl.google.com/dl/android/maven2') + $bases
  }
  return $bases
}

function Enqueue([string]$GroupId, [string]$ArtifactId, [string]$Version, [string]$Type = 'jar') {
  $Version = ($Version -replace '\s', '').Trim()
  if ([string]::IsNullOrWhiteSpace($GroupId) -or [string]::IsNullOrWhiteSpace($ArtifactId) -or [string]::IsNullOrWhiteSpace($Version)) {
    return
  }
  $key = "$GroupId`:$ArtifactId`:$Version"
  if ($visited.ContainsKey($key)) { return }
  $visited[$key] = $true
  $queue.Enqueue([pscustomobject]@{ GroupId = $GroupId; ArtifactId = $ArtifactId; Version = $Version; Type = $Type })
}

function Download-File([string]$Url, [string]$Dest) {
  $dir = Split-Path $Dest -Parent
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  if (Test-Path $Dest) { return $true }
  $curl = Get-Command curl.exe -ErrorAction SilentlyContinue
  if ($curl) {
    & curl.exe --ssl-no-revoke -fsSL $Url -o $Dest 2>$null
    if ($LASTEXITCODE -eq 0 -and (Test-Path $Dest)) { return $true }
  }
  try {
    Invoke-WebRequest -Uri $Url -OutFile $Dest -UseBasicParsing | Out-Null
    return $true
  } catch {
    return $false
  }
}

function Download-PomFiles([string]$GroupId, [string]$ArtifactId, [string]$Version) {
  $groupPath = Get-GroupPath $GroupId
  $destDir = Join-Path $OutDir "$groupPath/$ArtifactId/$Version"
  foreach ($base in (Get-RepoBases $GroupId)) {
    foreach ($ext in @('pom', 'module')) {
      $fileName = "$ArtifactId-$Version.$ext"
      $url = "$base/$groupPath/$ArtifactId/$Version/$fileName"
      $dest = Join-Path $destDir $fileName
      if (Download-File $url $dest) { break }
    }
  }
}

function Download-Binary([string]$GroupId, [string]$ArtifactId, [string]$Version, [string]$Type) {
  $groupPath = Get-GroupPath $GroupId
  $destDir = Join-Path $OutDir "$groupPath/$ArtifactId/$Version"
  $ext = if ($Type -eq 'aar') { 'aar' } else { 'jar' }
  $fileName = "$ArtifactId-$Version.$ext"
  $dest = Join-Path $destDir $fileName
  if (Test-Path $dest) { return }
  foreach ($base in (Get-RepoBases $GroupId)) {
    $url = "$base/$groupPath/$ArtifactId/$Version/$fileName"
    if (Download-File $url $dest) { break }
  }
}

function Get-PomPath([string]$GroupId, [string]$ArtifactId, [string]$Version) {
  return Join-Path $OutDir "$(Get-GroupPath $GroupId)/$ArtifactId/$Version/$ArtifactId-$Version.pom"
}

function Load-Pom([string]$GroupId, [string]$ArtifactId, [string]$Version) {
  Download-PomFiles $GroupId $ArtifactId $Version
  $pomPath = Get-PomPath $GroupId $ArtifactId $Version
  if (-not (Test-Path $pomPath)) { return $null }
  [xml]$doc = Get-Content $pomPath
  return $doc.project
}

function Resolve-Version($project, [string]$GroupId, [string]$ArtifactId, [string]$Version) {
  $Version = ($Version -replace '\s', '').Trim()
  if (-not [string]::IsNullOrWhiteSpace($Version)) { return $Version }
  if ($null -eq $project) { return $null }
  foreach ($dep in $project.dependencyManagement.dependencies.dependency) {
    if ([string]$dep.groupId -eq $GroupId -and [string]$dep.artifactId -eq $ArtifactId) {
      return ([string]$dep.version -replace '\s', '').Trim()
    }
  }
  return $null
}

function Process-Pom([string]$GroupId, [string]$ArtifactId, [string]$Version) {
  $Version = ($Version -replace '\s', '').Trim()
  $project = Load-Pom $GroupId $ArtifactId $Version
  if ($null -eq $project) { return }

  if ($null -ne $project.parent) {
    $pg = [string]$project.parent.groupId
    $pa = [string]$project.parent.artifactId
    $pv = ([string]$project.parent.version -replace '\s', '').Trim()
    if ($pg -and $pa -and $pv) {
      Process-Pom $pg $pa $pv
    }
  }

  $packaging = [string]$project.packaging
  if ([string]::IsNullOrWhiteSpace($packaging)) { $packaging = 'jar' }
  Download-Binary $GroupId $ArtifactId $Version $packaging

  foreach ($dep in $project.dependencies.dependency) {
    if ($null -eq $dep.groupId) { continue }
    $scope = [string]$dep.scope
    if ($scope -eq 'test') { continue }
    $dg = [string]$dep.groupId
    $da = [string]$dep.artifactId
    $dv = Resolve-Version $project $dg $da ([string]$dep.version)
    if ([string]::IsNullOrWhiteSpace($dv)) { continue }
    $depType = [string]$dep.type
    if ($depType -eq '') { $depType = 'jar' }
    Enqueue $dg $da $dv $depType
  }
}

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

Enqueue 'androidx.annotation' 'annotation' '1.8.1' 'jar'
Enqueue 'androidx.annotation' 'annotation-jvm' '1.8.1' 'jar'
Enqueue 'androidx.activity' 'activity' '1.8.0' 'aar'
Enqueue 'androidx.activity' 'activity-ktx' '1.8.0' 'aar'
Enqueue 'androidx.appcompat' 'appcompat-resources' '1.7.0' 'aar'
Enqueue 'androidx.appcompat' 'appcompat' '1.7.0' 'aar'
Enqueue 'androidx.lifecycle' 'lifecycle-livedata-core' '2.8.7' 'aar'
Enqueue 'androidx.lifecycle' 'lifecycle-livedata' '2.8.7' 'aar'
Enqueue 'androidx.lifecycle' 'lifecycle-common' '2.8.7' 'aar'
Enqueue 'androidx.lifecycle' 'lifecycle-common-jvm' '2.8.7' 'jar'
Enqueue 'androidx.lifecycle' 'lifecycle-viewmodel' '2.8.7' 'aar'
Enqueue 'androidx.lifecycle' 'lifecycle-runtime' '2.8.7' 'aar'
Enqueue 'androidx.lifecycle' 'lifecycle-runtime-android' '2.8.7' 'aar'
Enqueue 'androidx.lifecycle' 'lifecycle-runtime-ktx' '2.8.7' 'aar'
Enqueue 'androidx.lifecycle' 'lifecycle-runtime-ktx-android' '2.8.7' 'aar'
Enqueue 'androidx.lifecycle' 'lifecycle-viewmodel-ktx' '2.8.7' 'aar'
Enqueue 'androidx.lifecycle' 'lifecycle-viewmodel-savedstate' '2.8.7' 'aar'
Enqueue 'androidx.core' 'core' '1.13.1' 'aar'
Enqueue 'androidx.core' 'core-ktx' '1.13.1' 'aar'

while ($queue.Count -gt 0) {
  $item = $queue.Dequeue()
  Write-Host "Prefetch $($item.GroupId):$($item.ArtifactId):$($item.Version)"
  Process-Pom $item.GroupId $item.ArtifactId $item.Version
}

Write-Host "Done. Local Maven repo: $OutDir ($($visited.Count) coordinates)"
