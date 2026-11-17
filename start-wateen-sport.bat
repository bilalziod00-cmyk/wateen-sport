@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo جاري تشغيل تطبيق وتين سبورت (Wateen Sport)...
start "" http://127.0.0.1:4173
call npx.cmd vite preview --port 4173 --host 127.0.0.1
pause
