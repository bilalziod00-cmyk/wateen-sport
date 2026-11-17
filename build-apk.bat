@echo off
chcp 65001 >nul
echo === [1/3] بناء ملفات التطبيق (React + Vite) ===
call npm.cmd run build
if %errorlevel% neq 0 exit /b %errorlevel%

echo === [2/3] مزامنة مشروع أندرويد (Capacitor) ===
if not exist "android" (
  call npx.cmd cap add android
)
call npx.cmd cap sync android
if %errorlevel% neq 0 exit /b %errorlevel%

echo === [3/3] بناء ملف APK القابل للتثبيت ===
cd android
call gradlew.bat assembleDebug
if %errorlevel% neq 0 exit /b %errorlevel%

copy /Y "app\build\outputs\apk\debug\app-debug.apk" "..\download-page\WateenSport-v1.0.0.apk" >nul
echo.
echo تم بناء ملف APK بنجاح وحفظه في:
echo download-page\WateenSport-v1.0.0.apk
pause
