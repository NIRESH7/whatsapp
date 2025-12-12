#!/bin/bash

# Stop All ngrok Processes - Bash Script

echo "Stopping all ngrok processes..."

# Find and kill all ngrok processes
NGROK_PIDS=$(pgrep -f ngrok)

if [ -z "$NGROK_PIDS" ]; then
    echo "No ngrok processes found."
else
    echo "Found ngrok processes: $NGROK_PIDS"
    killall ngrok 2>/dev/null || pkill -f ngrok
    echo "All ngrok processes stopped!"
fi

echo "Done!"


