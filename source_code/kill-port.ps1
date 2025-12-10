# PowerShell script to kill process on port 3000
Write-Host "Checking for processes on port 3000..." -ForegroundColor Yellow

$port = 3000
$processes = netstat -ano | findstr ":$port"

if ($processes) {
    $pids = $processes | ForEach-Object {
        if ($_ -match '\s+(\d+)\s*$') {
            $matches[1]
        }
    } | Select-Object -Unique
    
    if ($pids) {
        Write-Host "Found processes using port $port : $($pids -join ', ')" -ForegroundColor Red
        foreach ($pid in $pids) {
            try {
                Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
                Write-Host "Killed process $pid" -ForegroundColor Green
            } catch {
                Write-Host "Could not kill process $pid : $_" -ForegroundColor Red
            }
        }
        Write-Host "Port $port is now free!" -ForegroundColor Green
    } else {
        Write-Host "No processes found on port $port" -ForegroundColor Green
    }
} else {
    Write-Host "Port $port is free!" -ForegroundColor Green
}

