@echo off
setlocal
taskkill /F /IM node.exe >nul 2>&1

start "Finance Backend" cmd /c "cd /d %USERPROFILE%\Desktop\Antigravity\finance-tracker\bot && node server.js"
start "Finance Frontend" cmd /c "cd /d %USERPROFILE%\Desktop\Antigravity\finance-tracker\webapp && npm run dev"

timeout /t 3 /nobreak >nul
start http://localhost:5173
