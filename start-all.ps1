# Start All Services - Windows PowerShell Script

Write-Host "Starting WhatsApp Application Services..." -ForegroundColor Green

# Start Backend
Write-Host "Starting Backend Server (Port 3000)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd $PSScriptRoot\source_code\whatsapp_integration; Write-Host 'Backend Server - Port 3000' -ForegroundColor Cyan; node server.js"

# Wait 2 seconds
Start-Sleep -Seconds 2

# Start Main Frontend
Write-Host "Starting Main Frontend (Port 5173)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd $PSScriptRoot\source_code; Write-Host 'Main Frontend - Port 5173' -ForegroundColor Cyan; npm run dev:client"

# Wait 2 seconds
Start-Sleep -Seconds 2

# Start WhatsApp Client Frontend
Write-Host "Starting WhatsApp Client Frontend (Port 5174)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd $PSScriptRoot\source_code\whatsapp_integration\client; Write-Host 'WhatsApp Client - Port 5174' -ForegroundColor Cyan; npm run dev"

# Wait 2 seconds
Start-Sleep -Seconds 2

# Stop any existing ngrok processes first
Write-Host "Checking for existing ngrok processes..." -ForegroundColor Yellow
$ngrokProcesses = Get-Process -Name "ngrok" -ErrorAction SilentlyContinue
if ($ngrokProcesses) {
    Write-Host "Stopping existing ngrok processes..." -ForegroundColor Yellow
    Stop-Process -Name "ngrok" -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
}

# Start ngrok
Write-Host "Starting ngrok Tunnel..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd $PSScriptRoot\source_code\whatsapp_integration; Write-Host 'ngrok Tunnel - Port 3000' -ForegroundColor Cyan; ngrok http 3000"

Write-Host "`nAll services started in separate windows!" -ForegroundColor Green
Write-Host "Backend: http://localhost:3000" -ForegroundColor White
Write-Host "Main Frontend: http://localhost:5173" -ForegroundColor White
Write-Host "WhatsApp Client: http://localhost:5174" -ForegroundColor White
Write-Host "`nCheck the ngrok window for the public URL" -ForegroundColor Yellow

