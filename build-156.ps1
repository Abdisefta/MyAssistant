$ErrorActionPreference = 'Continue'
robocopy 'C:\Users\user\My-assistent\MyAssistant\MyAssistantFinal' 'C:\b' /E /XD node_modules android\app\build android\app\.cxx android\build android\.gradle /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
Set-Location 'C:\b'
if (-not (Test-Path 'node_modules\react-native\package.json')) { npm ci }
(Get-Content 'C:\b\android\gradle.properties') -replace 'newArchEnabled=false','newArchEnabled=true' | Set-Content 'C:\b\android\gradle.properties'
(Get-Content 'C:\b\android\app\build.gradle') -replace 'CMAKE_OBJECT_PATH_MAX=128','CMAKE_OBJECT_PATH_MAX=32' | Set-Content 'C:\b\android\app\build.gradle'
Remove-Item -Recurse -Force 'C:\b\android\build','C:\b\android\app\.cxx','C:\b\android\app\build' -ErrorAction SilentlyContinue
$env:GRADLE_USER_HOME = 'C:\g'
Set-Location 'C:\b\android'
.\gradlew.bat --stop 2>&1 | Out-Null
.\gradlew.bat assembleRelease 2>&1 | Tee-Object 'C:\Users\user\Desktop\build-156.log'
$apk = 'C:\b\android\app\build\outputs\apk\release\app-release.apk'
if (Test-Path $apk) {
  Copy-Item $apk 'C:\Users\user\Desktop\MyAssistant156.apk' -Force
  'KLAR 156' | Add-Content 'C:\Users\user\Desktop\build-156.log'
} else {
  'MISSLYCKAD' | Add-Content 'C:\Users\user\Desktop\build-156.log'
}
