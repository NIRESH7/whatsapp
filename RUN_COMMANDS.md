# Run Commands for WhatsApp Application

## Prerequisites
Make sure you have Node.js installed and all dependencies installed:
```bash
# Install main frontend dependencies
cd source_code
npm install

# Install backend dependencies
cd whatsapp_integration
npm install

# Install WhatsApp client dependencies
cd client
npm install
```

---

## Separate Run Commands

### 1. Backend Server (Port 3000)
Open a terminal and run:
```bash
cd source_code/whatsapp_integration
node server.js
```

Or if you have nodemon installed:
```bash
cd source_code/whatsapp_integration
npx nodemon server.js
```

---

### 2. Main Frontend (Port 5173)
Open a **new terminal** and run:
```bash
cd source_code
npm run dev:client
```

---

### 3. WhatsApp Client Frontend (Port 5174)
Open a **new terminal** and run:
```bash
cd source_code/whatsapp_integration/client
npm run dev
```

---

### 4. ngrok (Tunnels Port 3000)

**IMPORTANT**: If you get an error about an existing tunnel, stop it first:

**Windows (PowerShell):**
```powershell
# Stop all ngrok processes
Get-Process -Name "ngrok" | Stop-Process -Force

# Or use the helper script
.\stop-ngrok.ps1
```

**Linux/Mac:**
```bash
# Stop all ngrok processes
pkill ngrok
# or
killall ngrok

# Or use the helper script
./stop-ngrok.sh
```

Then start ngrok:
```bash
cd source_code/whatsapp_integration
ngrok http 3000
```

Or using the config file:
```bash
cd source_code/whatsapp_integration
ngrok start whatsapp-server
```

---

## Quick Start Scripts (Windows PowerShell)

### Run All at Once (Windows)
Create a file `start-all.ps1`:
```powershell
# Start Backend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd source_code/whatsapp_integration; node server.js"

# Wait 2 seconds
Start-Sleep -Seconds 2

# Start Main Frontend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd source_code; npm run dev:client"

# Wait 2 seconds
Start-Sleep -Seconds 2

# Start WhatsApp Client Frontend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd source_code/whatsapp_integration/client; npm run dev"

# Wait 2 seconds
Start-Sleep -Seconds 2

# Start ngrok
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd source_code/whatsapp_integration; ngrok http 3000"
```

Then run:
```powershell
.\start-all.ps1
```

---

## Quick Start Scripts (Linux/Mac)

### Run All at Once (Bash)
Create a file `start-all.sh`:
```bash
#!/bin/bash

# Start Backend
cd source_code/whatsapp_integration
node server.js &
BACKEND_PID=$!

# Wait 2 seconds
sleep 2

# Start Main Frontend
cd ../..
cd source_code
npm run dev:client &
FRONTEND_PID=$!

# Wait 2 seconds
sleep 2

# Start WhatsApp Client Frontend
cd whatsapp_integration/client
npm run dev &
CLIENT_PID=$!

# Wait 2 seconds
sleep 2

# Start ngrok
cd ..
ngrok http 3000 &
NGROK_PID=$!

echo "All services started!"
echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"
echo "Client PID: $CLIENT_PID"
echo "ngrok PID: $NGROK_PID"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for Ctrl+C
trap "kill $BACKEND_PID $FRONTEND_PID $CLIENT_PID $NGROK_PID" EXIT
wait
```

Make it executable and run:
```bash
chmod +x start-all.sh
./start-all.sh
```

---

## Port Summary
- **Backend API**: http://localhost:3000
- **Main Frontend**: http://localhost:5173
- **WhatsApp Client Frontend**: http://localhost:5174
- **ngrok Tunnel**: https://[random-subdomain].ngrok.io (forwards to port 3000)

---

## Troubleshooting

### ngrok Error: "endpoint is already online"
If you see this error, stop existing ngrok processes first:

**Windows:**
```powershell
.\stop-ngrok.ps1
```

**Linux/Mac:**
```bash
./stop-ngrok.sh
```

Or manually:
- Windows: `Get-Process -Name "ngrok" | Stop-Process -Force`
- Linux/Mac: `pkill ngrok` or `killall ngrok`

---

## Notes
1. **Start Backend First**: Always start the backend server before the frontends
2. **ngrok URL**: After starting ngrok, copy the HTTPS URL and update your WhatsApp webhook URL in Facebook Developer Console
3. **Database**: Make sure PostgreSQL is running if you're using the database features
4. **Environment Variables**: Check if you need to set any environment variables in `.env` files
5. **Stop ngrok Before Restarting**: Always stop existing ngrok tunnels before starting a new one

