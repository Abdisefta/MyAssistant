# Project-local Java truststore so Gradle can download HTTPS deps (does not modify Android Studio).
$ErrorActionPreference = 'Continue'

$javaHome = 'C:\Program Files\Android\Android Studio\jbr'
$trustStore = Join-Path $PSScriptRoot '..\android\gradle-truststore.jks'
$srcCacerts = Join-Path $javaHome 'lib\security\cacerts'

if (-not (Test-Path $srcCacerts)) {
  throw "Android Studio JBR not found at $javaHome"
}

Copy-Item $srcCacerts $trustStore -Force
$keytool = Join-Path $javaHome 'bin\keytool.exe'
$imported = 0

Get-ChildItem Cert:\LocalMachine\Root | ForEach-Object {
  $tmp = [IO.Path]::GetTempFileName() + '.cer'
  Export-Certificate -Cert $_ -FilePath $tmp | Out-Null
  $alias = "win-$($_.Thumbprint)"
  & $keytool -importcert -trustcacerts -keystore $trustStore -storepass changeit -noprompt -alias $alias -file $tmp *> $null
  if ($LASTEXITCODE -eq 0) { $imported++ }
  Remove-Item $tmp -Force -ErrorAction SilentlyContinue
}

Write-Host "Truststore: $trustStore (imported $imported Windows root certs)"

# Quick verify
$dir = Join-Path $env:TEMP 'javatest2'
New-Item -ItemType Directory -Force -Path $dir | Out-Null
Set-Content (Join-Path $dir 'T.java') @"
import javax.net.ssl.*;
import java.net.URI;
public class T {
  public static void main(String[] a) throws Exception {
    var u = URI.create("https://dl.google.com/dl/android/maven2/com/google/guava/guava-parent/31.0.1-android/guava-parent-31.0.1-android.pom").toURL();
    var c = (HttpsURLConnection) u.openConnection();
    System.out.println("code=" + c.getResponseCode());
  }
}
"@
Push-Location $dir
& (Join-Path $javaHome 'bin\java.exe') "-Djavax.net.ssl.trustStore=$trustStore" "-Djavax.net.ssl.trustStorePassword=changeit" T.java 2>&1
Pop-Location
