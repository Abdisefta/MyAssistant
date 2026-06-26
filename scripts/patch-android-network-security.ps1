$ErrorActionPreference = 'Stop'
$androidRoot = if ($args.Count -gt 0) { $args[0] } else { 'C:\b\android' }

$xmlDir = Join-Path $androidRoot 'app\src\main\res\xml'
$xmlPath = Join-Path $xmlDir 'network_security_config.xml'
$manifestPath = Join-Path $androidRoot 'app\src\main\AndroidManifest.xml'

if (-not (Test-Path $manifestPath)) {
  Write-Host "Skip network security patch — no manifest at $manifestPath"
  exit 0
}

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
  $manifest = $manifest -replace '<application ', '<application android:networkSecurityConfig="@xml/network_security_config" '
}
if ($manifest -notmatch 'android:usesCleartextTraffic="true"') {
  $manifest = $manifest -replace '<application ', '<application android:usesCleartextTraffic="true" '
}
Set-Content -Path $manifestPath -Value $manifest -Encoding UTF8
Write-Host "Patched Android cleartext / network security config"
