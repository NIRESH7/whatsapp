# Troubleshooting Guide

## Issue: "Failed to initialize" or Socket.IO 404 Error

### Symptoms:
- Error: `GET http://localhost:3000/socket.io/?EIO=4&transport=polling 404 (Not Found)`
- WhatsApp Connect page shows "Failed to initialize"
- QR code doesn't appear

### Solution:

**1. Make sure the backend server is running:**

Open a terminal and run:
```bash
cd source_code/whatsapp_integration
node server.js
```

You should see:
```
Server is listening on port 3000
Socket.IO is ready for WhatsApp Web connections
```

**2. Check if port 3000 is already in use:**

**Windows:**
```powershell
netstat -ano | findstr :3000
```

**Linux/Mac:**
```bash
lsof -i :3000
```

If something is using port 3000, stop it first.

**3. Verify the server is accessible:**

Open your browser and go to:
```
http://localhost:3000/messages
```

You should see a JSON response (even if it's empty `[]`).

**4. Check browser console:**

Open browser DevTools (F12) and check:
- Network tab: Look for failed requests to `localhost:3000`
- Console tab: Look for connection errors

**5. Install missing dependencies:**

If you see module errors, install dependencies:
```bash
cd source_code/whatsapp_integration
npm install
```

**6. Check for database connection (if using PostgreSQL):**

If you see database errors, make sure PostgreSQL is running:
```bash
# Windows (if installed as service)
# Check Services app

# Linux/Mac
sudo systemctl status postgresql
```

---

## Issue: QR Code Not Appearing

### Solution:

1. **Wait a few seconds** - QR code generation can take 5-10 seconds
2. **Check backend console** - Look for `[WhatsApp Web] QR Code generated` message
3. **Refresh the page** - Sometimes a refresh helps
4. **Check browser console** - Look for Socket.IO connection errors
5. **Make sure Socket.IO is connected** - Check for `[WhatsApp Connect] Socket connected` in console

---

## Issue: Contacts Not Showing After Scanning

### Solution:

1. **After scanning QR code, click "Import Chat History" button**
2. **Wait for sync to complete** - You'll see progress updates
3. **Navigate to Chat page** - Contacts should appear there
4. **Check backend console** - Look for sync progress messages

---

## Quick Start Checklist

Before using WhatsApp Connect:

- [ ] Backend server is running on port 3000
- [ ] Frontend is running on port 5173
- [ ] No errors in backend console
- [ ] Socket.IO connection established (check browser console)
- [ ] Database is running (if using PostgreSQL)

---

## Common Errors

### "Cannot connect to server"
- Backend is not running
- Port 3000 is blocked by firewall
- Wrong URL in frontend code

### "Socket.IO 404"
- Backend server not running
- Socket.IO not properly initialized
- CORS issues (should be fixed now)

### "Failed to initialize"
- Backend server not running
- WhatsApp Web.js dependencies missing
- Database connection issues

---

## Still Having Issues?

1. Check all terminal windows - make sure backend is running
2. Restart the backend server
3. Clear browser cache and refresh
4. Check the backend console for detailed error messages
5. Make sure all dependencies are installed: `npm install` in both `source_code` and `source_code/whatsapp_integration`

