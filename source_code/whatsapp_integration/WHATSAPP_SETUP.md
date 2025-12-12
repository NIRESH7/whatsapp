# WhatsApp Integration Setup Guide

## Required Credentials

### 1. WhatsApp Business API Credentials

**Location:** `.env` file in `whatsapp_integration` folder

```env
# WhatsApp Business API
WHATSAPP_API_TOKEN=your_whatsapp_api_token_here
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id_here
WHATSAPP_BUSINESS_ACCOUNT_ID=your_business_account_id_here
```

**How to get these:**
1. Go to [Meta for Developers](https://developers.facebook.com/)
2. Create a new app or select existing app
3. Add "WhatsApp" product
4. Go to WhatsApp > API Setup
5. Copy:
   - **Phone Number ID** (shown in API Setup)
   - **Access Token** (Temporary or Permanent)
   - **Business Account ID** (in Settings)

---

### 2. Ngrok Setup

**What is Ngrok?**
Ngrok creates a public URL for your local server so WhatsApp can send webhooks to your computer.

**Installation:**
```powershell
# Download from https://ngrok.com/download
# Or install via chocolatey:
choco install ngrok
```

**Get Ngrok Auth Token:**
1. Sign up at [ngrok.com](https://ngrok.com/)
2. Go to Dashboard > Your Authtoken
3. Copy your authtoken

**Configure Ngrok:**
```powershell
ngrok config add-authtoken YOUR_AUTHTOKEN_HERE
```

**Start Ngrok:**
```powershell
cd c:\whatsapp\source_code\whatsapp_integration
ngrok http 3000
```

**Copy the public URL:**
- Ngrok will show: `https://xxxx-xx-xx-xxx-xxx.ngrok-free.app`
- Copy this URL

---

### 3. Configure WhatsApp Webhook

1. Go to Meta for Developers > Your App > WhatsApp > Configuration
2. Set **Webhook URL**: `https://your-ngrok-url.ngrok-free.app/webhook`
3. Set **Verify Token**: `your_custom_verify_token` (any string you choose)
4. Add to `.env`:
   ```env
   WEBHOOK_VERIFY_TOKEN=your_custom_verify_token
   ```
5. Subscribe to webhook fields:
   - ✅ messages
   - ✅ message_status

---

## Complete .env File Example

```env
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/whatsapp_db

# WhatsApp Business API
WHATSAPP_API_TOKEN=EAAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
WHATSAPP_PHONE_NUMBER_ID=123456789012345
WHATSAPP_BUSINESS_ACCOUNT_ID=123456789012345
WEBHOOK_VERIFY_TOKEN=my_secret_verify_token_123

# Session Secret
SESSION_SECRET=your_random_session_secret_here

# Google OAuth (optional)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

---

## How to Run

### 1. Start Database
```powershell
# Make sure PostgreSQL is running
```

### 2. Start Ngrok
```powershell
cd c:\whatsapp\source_code\whatsapp_integration
ngrok http 3000
```

### 3. Start Backend
```powershell
cd c:\whatsapp\source_code\whatsapp_integration
node server.js
```

### 4. Start Frontend
```powershell
cd c:\whatsapp\source_code
npm run dev
```

### 5. Access Application
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`
- Public URL: Your ngrok URL

---

## Quick Reference

| Item | Where to Find |
|------|---------------|
| **WhatsApp API Token** | Meta Developers > App > WhatsApp > API Setup |
| **Phone Number ID** | Meta Developers > App > WhatsApp > API Setup |
| **Business Account ID** | Meta Developers > App > Settings |
| **Ngrok Authtoken** | ngrok.com > Dashboard > Your Authtoken |
| **Webhook URL** | Your ngrok URL + `/webhook` |
| **Verify Token** | Any string you choose (must match in .env) |

---

## Troubleshooting

**Problem:** Webhook not receiving messages
- ✅ Check ngrok is running
- ✅ Verify webhook URL is correct in Meta
- ✅ Verify token matches in .env
- ✅ Check backend server is running

**Problem:** "EADDRINUSE" error
```powershell
# Kill all node processes
taskkill /F /IM node.exe
# Then restart server
node server.js
```

**Problem:** Database connection error
- ✅ Check PostgreSQL is running
- ✅ Verify DATABASE_URL in .env
- ✅ Check database exists

---

## Support Links

- [WhatsApp Business API Docs](https://developers.facebook.com/docs/whatsapp)
- [Ngrok Documentation](https://ngrok.com/docs)
- [Meta for Developers](https://developers.facebook.com/)
