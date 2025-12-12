# Stop All ngrok Processes - Windows PowerShell

Write-Host "Stopping all ngrok processes..." -ForegroundColor Yellow

# Find and stop all ngrok processes
$ngrokProcesses = Get-Process -Name "ngrok" -ErrorAction SilentlyContinue

if ($ngrokProcesses) {
    foreach ($process in $ngrokProcesses) {
        Write-Host "Stopping ngrok process (PID: $($process.Id))..." -ForegroundColor Cyan
        Stop-Process -Id $process.Id -Force
    }
    Write-Host "All ngrok processes stopped!" -ForegroundColor Green
} else {
    Write-Host "No ngrok processes found." -ForegroundColor Gray
}

# Also try to stop via ngrok API if available
try {
    # This requires ngrok API to be enabled
    $tunnels = ngrok api tunnels list 2>$null
    if ($tunnels) {
        Write-Host "Attempting to stop tunnels via API..." -ForegroundColor Cyan
        # Note: This requires ngrok API key to be set
    }
} catch {
    # API not available, that's okay
}

Write-Host "Done!" -ForegroundColor Green


