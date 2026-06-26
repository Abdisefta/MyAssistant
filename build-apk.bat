@echo off
setlocal EnableExtensions
set NODE_ENV=development
set TEMP=C:\tmp
set TMP=C:\tmp
set LOCALAPPDATA=C:\l
set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr
set GRADLE_USER_HOME=C:\g
set GRADLE_OPTS=-Djavax.net.ssl.trustStore=C:\Users\user\.gradle\avast-truststore.jks -Djavax.net.ssl.trustStorePassword=changeit -Dorg.gradle.user.home=C:\g
set PATH=%JAVA_HOME%\bin;C:\l\Android\Sdk\platform-tools;%PATH%

if not exist C:\tmp mkdir C:\tmp
if not exist C:\g mkdir C:\g
if not exist C:\l\Temp mkdir C:\l\Temp
if not exist C:\l\Android mklink /J C:\l\Android "%USERPROFILE%\AppData\Local\Android" 2>nul

rmdir /s /q "%USERPROFILE%\AppData\Local\Temp\cursor-sandbox-cache" 2>nul
rmdir /s /q "C:\tmp\cursor-sandbox-cache" 2>nul

echo Rensar gammal C++-cache...
for /d /r "%~dp0node_modules" %%D in (.cxx) do @if exist "%%D" rmdir /s /q "%%D" 2>nul

cd /d "%~dp0android"
echo Build start: %DATE% %TIME% > "%~dp0build-apk-latest.log"
echo GRADLE_USER_HOME=%GRADLE_USER_HOME%>> "%~dp0build-apk-latest.log"
call "C:\Users\user\.gradle\wrapper\dists\gradle-8.14.3-bin\cv11ve7ro1n3o1j4so8xd9n66\gradle-8.14.3\bin\gradle.bat" -g C:\g assembleDebug --no-daemon >> "%~dp0build-apk-latest.log" 2>&1
set ERR=%ERRORLEVEL%
echo EXIT_CODE=%ERR%>> "%~dp0build-apk-latest.log"
if %ERR%==0 (
  echo APK: %~dp0android\app\build\outputs\apk\debug\app-debug.apk>> "%~dp0build-apk-latest.log"
)
exit /b %ERR%
