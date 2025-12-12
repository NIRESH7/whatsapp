# 🌐 Website Flow - Complete Guide

## 📋 Overview
Your website is a WhatsApp Web integration platform that allows users to connect their WhatsApp account, sync all chats/contacts/messages, and manage conversations in real-time.

---

## 🔄 Complete User Flow

### **STEP 1: User Login & Authentication**
```
User visits website → Login page (port 5175) → Authenticated → Redirected to main app (port 5173)
```

**Files:**
- `src/pages/Login.tsx` - Login interface
- `src/App.tsx` - Authentication check and routing

**Flow:**
1. User opens `http://localhost:5173` or `http://localhost:5175`
2. If not authenticated, redirected to login page
3. After login, `localStorage.setItem('isAuthenticated', 'true')` is set
4. User is redirected to Dashboard (`/`)

---

### **STEP 2: Dashboard (Command Center)**
```
Dashboard → Shows metrics, alerts, system status
```

**Route:** `/`
**File:** `src/pages/Dashboard.tsx`

**Features:**
- Key Metrics display (Open Conversations, Pending Approvals, API Health, Daily Active Users)
- Smart Alert System
- Context Panel (AI insights)

**Navigation:**
- User can navigate to:
  - `/whatsapp-connect` - Connect WhatsApp
  - `/chat` - Chat interface
  - `/inbox` - Inbox view
  - `/templates` - Template Forge

---

### **STEP 3: WhatsApp Connection Flow**

**Route:** `/whatsapp-connect`
**File:** `src/pages/WhatsAppConnect.tsx`

#### **3.1 Initialization**
```
User clicks "Connect WhatsApp" → Backend initializes WhatsApp Web client → QR Code generated
```

**Backend Process:**
1. Frontend calls: `POST /api/whatsapp-web/init`
2. Backend (`server.js`) calls `whatsappWebService.initializeClient(userId)`
3. WhatsApp Web.js library starts Puppeteer browser
4. QR code is generated and sent via Socket.IO: `socket.emit('qr-code', qrImage)`
5. Frontend displays QR code

#### **3.2 QR Code Scanning**
```
User scans QR code with phone → WhatsApp Web authenticates → Backend receives 'ready' event
```

**Backend Process:**
1. WhatsApp Web.js detects QR scan
2. Emits `authenticated` event
3. Emits `ready` event with phone number
4. Frontend receives `ready` event via Socket.IO

#### **3.3 Auto-Sync Trigger**
```
'ready' event received → Frontend automatically calls sync → Backend starts fetching all data
```

**Frontend (`WhatsAppConnect.tsx` lines 114-164):**
```javascript
socket.on('ready', async (data) => {
    // Auto-start sync immediately
    axios.post('/api/whatsapp-web/sync')
});
```

**Backend Process:**
1. Frontend calls: `POST /api/whatsapp-web/sync`
2. Backend calls: `whatsappWebService.syncChatHistory(userId, io)`
3. Sync process starts in `whatsapp-web-service.js`

---

### **STEP 4: Complete Data Sync Process**

**File:** `whatsapp_integration/whatsapp-web-service.js`
**Function:** `syncChatHistory(userId, io)` (lines 613-1198)

#### **4.1 Fetch All Chats**
```javascript
const chats = await client.getChats();
const chatsToSync = chats; // NO LIMIT - fetches ALL chats
```

**What happens:**
- Gets ALL chats from WhatsApp Web (no 50-chat limit)
- For each chat:
  - Extracts contact number
  - Fetches contact name using Puppeteer (`window.Store.Contact`)
  - Saves to database

#### **4.2 Save Contacts to Database**
```javascript
await pool.query(
    `INSERT INTO whatsapp_contacts (user_id, contact_number, contact_name, profile_pic_url)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, contact_number) DO UPDATE SET
     contact_name = COALESCE(NULLIF($3, ''), whatsapp_contacts.contact_name)`,
    [userId, normalizedNumber, finalContactName, chat.profilePicUrl]
);
```

**Database Table:** `whatsapp_contacts`
- `user_id` - Which user owns this contact
- `contact_number` - Phone number (normalized)
- `contact_name` - Contact name from WhatsApp
- `profile_pic_url` - Profile picture URL

#### **4.3 Save Chats to Database**
```javascript
await pool.query(
    `INSERT INTO whatsapp_chats (user_id, chat_id, contact_number, is_group, group_name, last_message_time)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (user_id, chat_id) DO UPDATE SET
     last_message_time = COALESCE($6, whatsapp_chats.last_message_time)`,
    [userId, chat.id._serialized, contactNumber, isGroup, groupName, lastMessageTime]
);
```

**Database Table:** `whatsapp_chats`
- `user_id` - User ID
- `chat_id` - WhatsApp chat ID
- `contact_number` - Contact phone number
- `is_group` - Is group chat?
- `group_name` - Group name (if group)
- `last_message_time` - Last message timestamp
- `unread_count` - Unread message count

#### **4.4 Fetch ALL Messages (No Limit)**
```javascript
// Fetch up to 200,000 messages per chat using batching
let batchSize = 10000;
let maxAttempts = 20;
let allMessages = [];

for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const batch = await manualFetchMessages(client, chat.id._serialized, batchSize);
    allMessages.push(...batch);
    if (batch.length < batchSize) break; // No more messages
}
```

**What happens:**
- For each chat, fetches ALL messages in batches of 10,000
- Continues until no more messages available
- Up to 200,000 messages per chat (20 batches × 10,000)

#### **4.5 Save Messages to Database**
```javascript
// For each message
await saveMessage(userId, message, client);
```

**Function:** `saveMessage(userId, message, client)` (lines 1265-1415)

**Process:**
1. Filters JSON strings from message body (removes `{"server":"lid","user":"..."}`)
2. Formats message data
3. Saves to database:

```javascript
await pool.query(
    `INSERT INTO whatsapp_web_messages
     (user_id, message_id, chat_id, sender, recipient, message_text, message_type, 
      media_url, is_from_me, timestamp)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (message_id) DO UPDATE SET
     message_text = COALESCE($6, whatsapp_web_messages.message_text)`,
    [userId, messageId, chatId, sender, recipient, cleanText, messageType, 
     mediaUrl, isFromMe, timestamp]
);
```

**Database Table:** `whatsapp_web_messages`
- `user_id` - User ID
- `message_id` - Unique WhatsApp message ID
- `chat_id` - Chat ID
- `sender` - Sender phone number
- `recipient` - Recipient phone number
- `message_text` - Message text (JSON filtered)
- `message_type` - Type (text, image, video, etc.)
- `media_url` - Media file URL (if media)
- `is_from_me` - Is sent by user?
- `timestamp` - Message timestamp

#### **4.6 Real-Time Progress Updates**
```javascript
// Emit progress to frontend
io.to(`user-${userId}`).emit('sync-progress', {
    stage: 'chats',
    current: i + 1,
    total: chats.length,
    messages: totalMessages,
    currentContact: displayName
});

// Emit contact updates
io.to(`user-${userId}`).emit('contact-updated', {
    contactNumber: contactNumber,
    contactName: finalContactName,
    contactIndex: i + 1,
    totalContacts: chats.length
});
```

**Frontend receives:**
- `sync-progress` - Shows progress (X/Y contacts, messages count)
- `contact-updated` - Individual contact fetched (progressive display)

#### **4.7 Sync Complete**
```javascript
io.to(`user-${userId}`).emit('sync-complete', {
    chats: chats.length,
    messages: totalMessages,
    contacts: contactCount,
    totalChats: chats.length,
    totalContacts: chats.length
});
```

**Frontend (`WhatsAppConnect.tsx` lines 227-254):**
- Receives `sync-complete` event
- Shows completion message
- Redirects to `/chat` after 2 seconds

---

### **STEP 5: Chat Interface**

**Route:** `/chat`
**File:** `src/pages/Chat.tsx`

#### **5.1 Load Contacts List**
```javascript
const refreshContacts = async () => {
    // Fetch all conversations
    const conversationsRes = await axios.get('/api/whatsapp-business/conversations', {
        timeout: 60000
    });
    
    // Process and display contacts
    const processed = processContacts(conversationsRes.data);
    setContacts(processed);
};
```

**Backend API:** `GET /api/whatsapp-business/conversations`
**File:** `server.js` (lines ~800-900)

**Process:**
1. Queries `whatsapp_chats` table for all chats
2. Joins with `whatsapp_contacts` to get contact names
3. Gets last message from `whatsapp_web_messages`
4. Returns:
   ```json
   {
     "number": "919345034653",
     "name": "Contact Name",
     "lastMessageTime": "2024-01-01T12:00:00Z",
     "lastMessageText": "Last message text",
     "unreadCount": 5
   }
   ```

#### **5.2 Display Contacts**
**Frontend (`Chat.tsx` lines 62-166):**
- Shows contact name (or phone number if no name)
- Shows last message preview (JSON filtered)
- Shows unread count badge (blue circle)
- Shows last message time

**Name Display Logic:**
```javascript
// Priority: contact.name → contact.number → "Unknown Contact"
if (contact.name && contact.name !== contact.number) {
    const cleaned = cleanContactName(contact.name);
    return cleaned === 'Unknown Contact' ? contact.name : cleaned;
}
```

#### **5.3 Select Contact & Load Messages**
```javascript
const fetchMessages = async (contactNumber: string) => {
    // Extract phone number (handles JSON objects)
    const phoneNumber = extractPhoneNumber(contactNumber);
    
    // Fetch messages from database
    const messagesRes = await axios.get(
        `/api/whatsapp-business/contacts/${phoneNumber}/messages`,
        { timeout: 60000 }
    );
    
    // If no messages, trigger sync
    if (messagesRes.data.length === 0) {
        await axios.post('/messages/sync', { phoneNumber }, { timeout: 300000 });
        // Re-fetch after sync
    }
};
```

**Backend API:** `GET /api/whatsapp-business/contacts/:phoneNumber/messages`
**File:** `server.js` (lines ~1000-1100)

**Process:**
1. Queries `whatsapp_web_messages` table
2. Filters by `chat_id` or `contact_number`
3. Orders by `timestamp DESC`
4. Returns messages array

#### **5.4 Send Message**
```javascript
const handleSendMessage = async (text: string) => {
    // Optimistic UI update
    const tempMessage = {
        id: `temp-${Date.now()}`,
        text,
        type: 'sent',
        time: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempMessage]);
    
    // Send to backend
    await axios.post('/api/whatsapp-business/send-message', {
        phoneNumber: activeContact.number,
        message: text
    });
};
```

**Backend API:** `POST /api/whatsapp-business/send-message`
**File:** `server.js` (lines ~400-500)

**Process:**
1. Validates phone number
2. Sends message via WhatsApp Web.js: `client.sendMessage(chatId, text)`
3. Message is automatically saved to database via `message` event listener
4. Returns success

---

### **STEP 6: Real-Time Message Updates**

#### **6.1 Backend Message Listener**
**File:** `whatsapp-web-service.js` (lines ~200-400)

```javascript
client.on('message', async (message) => {
    // Save message to database
    await saveMessage(userId, message, client);
    
    // Update chat unread count
    await pool.query(
        `UPDATE whatsapp_chats 
         SET unread_count = unread_count + 1,
             last_message_time = $1
         WHERE user_id = $2 AND contact_number = $3`,
        [timestamp, userId, contactNumber]
    );
    
    // Emit to frontend
    io.to(`user-${userId}`).emit('new-message', {
        chatId: message.from,
        message: formatMessage(message),
        contactNumber: contactNumber
    });
});
```

#### **6.2 Frontend Socket Listener**
**File:** `Chat.tsx` (lines 191-235)

```javascript
socket.on('new-message', (data) => {
    // If message is for active chat, add to messages
    if (activeContact && extractPhoneNumber(activeContact.number) === data.contactNumber) {
        setMessages(prev => [...prev, data.message]);
        
        // Mark as read
        axios.post('/messages/read', { phoneNumber: data.contactNumber });
    }
    
    // Refresh contacts list (updates unread count, last message)
    refreshContacts();
});
```

#### **6.3 Mark Message as Read**
**Backend API:** `POST /messages/read`
**File:** `server.js` (lines 193-219)

```javascript
// Update unread_count to 0 in whatsapp_chats table
await pool.query(
    `UPDATE whatsapp_chats 
     SET unread_count = 0 
     WHERE user_id = $1 AND contact_number = $2`,
    [userId, phoneNumber]
);
```

---

### **STEP 7: Database Schema**

#### **Tables:**

1. **`whatsapp_sessions`**
   - Stores WhatsApp Web session data
   - `user_id`, `session_data`, `phone_number`, `is_active`, `last_sync`

2. **`whatsapp_contacts`**
   - Stores all contacts
   - `user_id`, `contact_number`, `contact_name`, `profile_pic_url`

3. **`whatsapp_chats`**
   - Stores chat metadata
   - `user_id`, `chat_id`, `contact_number`, `is_group`, `group_name`, `last_message_time`, `unread_count`

4. **`whatsapp_web_messages`**
   - Stores ALL messages
   - `user_id`, `message_id`, `chat_id`, `sender`, `recipient`, `message_text`, `message_type`, `media_url`, `is_from_me`, `timestamp`

---

## 🔄 Complete Data Flow Diagram

```
┌─────────────┐
│   User      │
│  (Browser)  │
└──────┬──────┘
       │
       │ 1. Login
       ▼
┌─────────────┐
│  Frontend   │  React App (port 5173)
│  (React)    │
└──────┬──────┘
       │
       │ 2. Connect WhatsApp
       ▼
┌─────────────┐
│   Backend   │  Express Server (port 3000)
│  (Node.js)  │
└──────┬──────┘
       │
       │ 3. Initialize WhatsApp Web
       ▼
┌─────────────┐
│  WhatsApp   │  whatsapp-web.js + Puppeteer
│  Web Client │
└──────┬──────┘
       │
       │ 4. Fetch Data
       ▼
┌─────────────┐
│  WhatsApp   │  WhatsApp Web (web.whatsapp.com)
│  Web Server │
└──────┬──────┘
       │
       │ 5. Save to Database
       ▼
┌─────────────┐
│  PostgreSQL │  Database (port 5432)
│  Database   │
└─────────────┘
       │
       │ 6. Real-time Updates
       ▼
┌─────────────┐
│  Socket.IO  │  WebSocket Connection
│  (Real-time)│
└──────┬──────┘
       │
       │ 7. Update Frontend
       ▼
┌─────────────┐
│   Frontend  │  UI Updates
│  (React)    │
└─────────────┘
```

---

## 📊 Key Features

### ✅ **Complete Data Fetching**
- **NO LIMITS** - Fetches ALL chats, ALL contacts, ALL messages
- Up to 200,000 messages per chat (batched)
- Progressive loading with real-time updates

### ✅ **Contact Name Display**
- Fetches names from WhatsApp Web using Puppeteer
- Falls back to phone number if no name
- Filters out JSON strings and invalid data

### ✅ **Real-Time Updates**
- Socket.IO for instant message delivery
- Unread count badges (blue circles)
- Auto-refresh contact list on new messages

### ✅ **Message Management**
- Send messages via WhatsApp Web
- Receive messages in real-time
- Mark messages as read
- Complete chat history

### ✅ **Database Storage**
- All data saved to PostgreSQL
- Contacts, chats, messages stored permanently
- Fast queries for frontend display

---

## 🚀 How to Run

1. **Start PostgreSQL** (port 5432)
2. **Start Backend:** `cd source_code/whatsapp_integration && node server.js`
3. **Start Frontend:** `cd source_code && npm run dev` (port 5173)
4. **Start ngrok:** `ngrok http 3000` (for webhooks)

---

## 📝 Summary

Your website flow:
1. **Login** → Authenticate user
2. **Connect** → Scan QR code, connect WhatsApp
3. **Sync** → Fetch ALL chats, contacts, messages (no limits)
4. **Save** → Store everything in PostgreSQL database
5. **Display** → Show contacts and messages in chat interface
6. **Real-time** → Receive new messages instantly via Socket.IO
7. **Update** → Auto-update UI with unread counts and new messages

**Everything is saved to the database!** ✅

