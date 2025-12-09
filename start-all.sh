#!/bin/bash

# Start All Services - Bash Script

echo "Starting WhatsApp Application Services..."

# Get the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Start Backend
echo "Starting Backend Server (Port 3000)..."
cd "$SCRIPT_DIR/source_code/whatsapp_integration"
node server.js &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

# Wait 2 seconds
sleep 2

# Start Main Frontend
echo "Starting Main Frontend (Port 5173)..."
cd "$SCRIPT_DIR/source_code"
npm run dev:client &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"

# Wait 2 seconds
sleep 2

# Start WhatsApp Client Frontend
echo "Starting WhatsApp Client Frontend (Port 5174)..."
cd "$SCRIPT_DIR/source_code/whatsapp_integration/client"
npm run dev &
CLIENT_PID=$!
echo "Client PID: $CLIENT_PID"

# Wait 2 seconds
sleep 2

# Stop any existing ngrok processes first
echo "Checking for existing ngrok processes..."
pkill -f ngrok 2>/dev/null || true
sleep 1

# Start ngrok
echo "Starting ngrok Tunnel..."
cd "$SCRIPT_DIR/source_code/whatsapp_integration"
ngrok http 3000 &
NGROK_PID=$!
echo "ngrok PID: $NGROK_PID"

echo ""
echo "=========================================="
echo "All services started!"
echo "=========================================="
echo "Backend: http://localhost:3000"
echo "Main Frontend: http://localhost:5173"
echo "WhatsApp Client: http://localhost:5174"
echo ""
echo "PIDs:"
echo "  Backend: $BACKEND_PID"
echo "  Frontend: $FRONTEND_PID"
echo "  Client: $CLIENT_PID"
echo "  ngrok: $NGROK_PID"
echo ""
echo "Press Ctrl+C to stop all services"
echo "=========================================="

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "Stopping all services..."
    kill $BACKEND_PID $FRONTEND_PID $CLIENT_PID $NGROK_PID 2>/dev/null
    echo "All services stopped."
    exit 0
}

# Trap Ctrl+C
trap cleanup SIGINT SIGTERM

# Wait for all background processes
wait

