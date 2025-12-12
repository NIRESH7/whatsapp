# Single Port Setup Guide

Your application now runs on **ONE PORT ONLY: 3000**

## 🚀 How to Run

### Step 1: Build the Frontend
```bash
cd c:\whatsapp\source_code
npm run build
```

### Step 2: Start the Server
```bash
npm start
```

Or use the dev command (auto-builds on changes):
```bash
npm run dev
```

### Step 3: Open in Browser
Open: **http://localhost:3000**

## 📁 What Changed

1. **Frontend is built** and served from `dist/` folder
2. **Express server** serves both API and frontend on port 3000
3. **All URLs** now use relative paths (no hardcoded ports)
4. **Socket.IO** connects to the same port

## 🔧 Development vs Production

### Development Mode (with auto-rebuild):
```bash
npm run dev
```
- Watches for changes and rebuilds automatically
- Server restarts on backend changes

### Production Mode:
```bash
npm run build
npm start
```
- Builds once
- Serves optimized production build

## ✅ Benefits

- ✅ Single port (3000) - easier to manage
- ✅ No CORS issues - same origin
- ✅ Simpler deployment
- ✅ Better for production
- ✅ All features work on one port

## 🐛 Troubleshooting

If you see "Frontend build not found":
1. Run `npm run build` first
2. Then run `npm start`

If port 3000 is in use:
- Run `npm run kill-port` or use the `kill-port.ps1` script


