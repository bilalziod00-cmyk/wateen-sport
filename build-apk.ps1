# سكربت بناء وتصدير ملف APK لتطبيق وتين سبورت (Wateen Sport) على Windows
$ErrorActionPreference = "Stop"

Write-Host "=== [1/4] بناء ملفات التطبيق (React + Vite) ===" -ForegroundColor Green
npm.cmd run build

Write-Host "=== [2/4] مزامنة مشروع أندرويد (Capacitor) ===" -ForegroundColor Green
if (!(Test-Path ".\android")) {
  npx.cmd cap add android
}
npx.cmd cap sync android

Write-Host "=== [3/4] تطبيق أيقونة التطبيق وشاشة البداية وإعدادات العربية ===" -ForegroundColor Green
& .\scripts\apply-android-branding.ps1

Write-Host "=== [4/4] بناء حزمة الأندرويد APK ===" -ForegroundColor Green
Push-Location ".\android"
try {
  .\gradlew.bat assembleDebug
  $apkPath = Resolve-Path ".\app\build\outputs\apk\debug\app-debug.apk"
  Copy-Item $apkPath "..\download-page\WateenSport-v1.0.0.apk" -Force
  Write-Host "`nتم تصدير ملف APK بنجاح إلى:" -ForegroundColor Cyan
  Write-Host (Resolve-Path "..\download-page\WateenSport-v1.0.0.apk") -ForegroundColor Yellow
} finally {
  Pop-Location
}
