@echo off
echo Stopping any existing processes on port 3000...
powershell -ExecutionPolicy Bypass -File "%~dp0kill-port.ps1"
echo.
echo Starting server...
cd /d "%~dp0"
npm run dev


