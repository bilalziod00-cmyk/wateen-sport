# سكربت بناء وتصدير ملف APK لتطبيق وتين سبورت (Wateen Sport) على Windows
$ErrorActionPreference = "Stop"

# التأكد من وجود Node.js في PATH للجلسة الحالية
if (Test-Path "C:\Program Files\nodejs") {
  $env:Path = "C:\Program Files\nodejs;$env:Path"
}

Write-Host "=== [1/5] تجهيز الهوية البصرية والأيقونات وشاشة الافتتاح (assets/branding) ===" -ForegroundColor Green
& .\scripts\apply-android-branding.ps1

Write-Host "=== [2/5] فحص وبناء ملفات التطبيق (TypeScript + React + Vite) ===" -ForegroundColor Green
npm.cmd run build

Write-Host "=== [3/5] مزامنة مشروع أندرويد (Capacitor) ===" -ForegroundColor Green
if (!(Test-Path ".\android")) {
  npx.cmd cap add android
}
npx.cmd cap sync android

Write-Host "=== [4/5] تطبيق الأيقونة التكيفية وشاشة البداية وإعدادات أندرويد الأصلية ===" -ForegroundColor Green
& .\scripts\apply-android-branding.ps1

Write-Host "=== [5/5] بناء حزمة الأندرويد النهائية (Release & Debug APK) ===" -ForegroundColor Green
Push-Location ".\android"
try {
  .\gradlew.bat assembleRelease assembleDebug

  $releaseApk = Resolve-Path ".\app\build\outputs\apk\release\app-release.apk"

  # نسخ ملف APK النهائي إلى جميع المسارات المطلوبة
  $targetPaths = @(
    "..\download-page\WateenSport-v1.0.0.apk",
    "..\build\app\outputs\flutter-apk\app-release.apk",
    "..\..\build\app\outputs\flutter-apk\app-release.apk"
  )

  foreach ($relTarget in $targetPaths) {
    $fullTarget = Join-Path (Get-Location) $relTarget
    $targetDir = Split-Path $fullTarget -Parent
    if (!(Test-Path $targetDir)) {
      New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
    }
    Copy-Item $releaseApk $fullTarget -Force
    Write-Host "تم حفظ نسخة APK في: $fullTarget" -ForegroundColor Cyan
  }
} finally {
  Pop-Location
}
