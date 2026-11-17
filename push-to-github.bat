@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ========================================================
echo   رفع مشروع وتين سبورت إلى GitHub وبناء ملف APK تلقائياً
echo ========================================================
echo.
git push -u origin main
echo.
if %errorlevel% equ 0 (
  echo [نجاح] تم رفع المشروع إلى GitHub بنجاح!
  echo سيعمل البناء التلقائي لملف APK خلال ~3 دقائق على الرابط:
  echo https://github.com/bilalziod00-cmyk/wateen-sport/actions
  echo.
  echo رابط التحميل المباشر الدائم لملف APK بعد اكتمال البناء:
  echo https://github.com/bilalziod00-cmyk/wateen-sport/releases/latest/download/WateenSport-v1.0.0.apk
  start "" https://github.com/bilalziod00-cmyk/wateen-sport/actions
) else (
  echo [ملاحظة] لم يكتمل الرفع. تأكد من تسجيل الدخول في نافذة GitHub ثم أعد المحاولة.
)
echo.
pause
