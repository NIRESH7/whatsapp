const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'postgres',
    password: '2006',
    port: 5432,
});

// Store active WhatsApp clients (one per user)
// Store active WhatsApp clients (one per user)
const activeClients = new Map();
// Store latest QR code for each user to handle refreshes/race conditions
const userQrCodes = new Map();

// Locks to prevent race conditions
const initializingUsers = new Set();

/**
 * Initialize WhatsApp client for a user
 */
async function initializeClient(userId, io) {
    // 1. Handle in-progress initialization
    if (initializingUsers.has(userId)) {
        console.log(`[WhatsApp Web] Initialization already in progress for user ${userId}.`);
        // If we have a QR code ready, send it to the (possibly new) socket connection!
        if (userQrCodes.has(userId)) {
            console.log(`[WhatsApp Web] Emitting cached QR code for user ${userId}`);
            io.to(`user-${userId}`).emit('qr-code', userQrCodes.get(userId));
        }
        return activeClients.get(userId);
    }

    initializingUsers.add(userId);
    console.log(`[WhatsApp Web] Initializing client for user ${userId}`);

    try {
        // CRITICAL FIX: Check and clean old/corrupted sessions before initializing
        const fs = require('fs');
        const path = require('path');
        const sessionPath = path.join(__dirname, 'whatsapp-sessions', `session-user-${userId}`);
        
        // If old session exists but client is not ready, delete it to force fresh QR
        if (fs.existsSync(sessionPath) && !activeClients.has(userId)) {
            console.log(`[WhatsApp Web] 🧹 Old session found for user ${userId}, checking if valid...`);
            // Check if session is too old (older than 1 day) or if we should force fresh
            try {
                const stats = fs.statSync(sessionPath);
                const age = Date.now() - stats.mtime.getTime();
                const oneDay = 24 * 60 * 60 * 1000;
                
                if (age > oneDay) {
                    console.log(`[WhatsApp Web] 🗑️ Deleting old session (${Math.round(age / oneDay)} days old) to force fresh QR...`);
                    fs.rmSync(sessionPath, { recursive: true, force: true });
                }
            } catch (cleanErr) {
                console.log(`[WhatsApp Web] ⚠️ Could not check session age, proceeding anyway:`, cleanErr.message);
            }
        }

        // 2. Check existing client
        if (activeClients.has(userId)) {
            const existingClient = activeClients.get(userId);

            if (existingClient.info && existingClient.info.wid) {
                // Already authenticated
                console.log(`[WhatsApp Web] Client already exists and is ready for user ${userId}`);
                io.to(`user-${userId}`).emit('ready', { phoneNumber: existingClient.info.wid.user });
                initializingUsers.delete(userId);
                return existingClient;
            }

            // Client exists but not fully ready. 
            // Check if we have a valid QR code cached (optimization)
            if (userQrCodes.has(userId)) {
                console.log(`[WhatsApp Web] Client exists and has valid QR. Emitting cached QR...`);
                io.to(`user-${userId}`).emit('qr-code', userQrCodes.get(userId));
                initializingUsers.delete(userId);
                return existingClient;
            }

            // CHECK: Is it still warming up? (Grace period of 20 seconds)
            if (existingClient.startTime && (Date.now() - existingClient.startTime < 20000)) {
                console.log(`[WhatsApp Web] Client matches user ${userId} and is still starting up (${Date.now() - existingClient.startTime}ms). Waiting...`);
                initializingUsers.delete(userId);
                return existingClient;
            }

            // No valid QR, not ready, and timed out -> Destroy and retry
            console.log(`[WhatsApp Web] Client exists but stalled (not ready/no QR for >20s), reinitializing...`);
            try {
                await existingClient.destroy();
            } catch (e) {
                console.error('[WhatsApp Web] Error destroying existing client (ignoring):', e.message);
            }
            activeClients.delete(userId);
            userQrCodes.delete(userId);
            // Wait a moment for resources to free up
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        // Create new WhatsApp client with better error handling
        console.log(`[WhatsApp Web] Creating new client for user ${userId}...`);
        
        // CRITICAL FIX: Try headless: false first to see what's happening, then can switch back
        const client = new Client({
            authStrategy: new LocalAuth({
                clientId: `user-${userId}`,
                dataPath: './whatsapp-sessions'
            }),
            puppeteer: {
                headless: 'new', // Use 'new' for better compatibility
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu',
                    '--disable-software-rasterizer',
                    '--disable-extensions',
                    '--disable-background-timer-throttling',
                    '--disable-backgrounding-occluded-windows',
                    '--disable-renderer-backgrounding'
                ],
                timeout: 90000, // 90 second timeout
                executablePath: undefined // Let Puppeteer find Chrome automatically
            }
        });

        // Mark start time to prevent premature destruction
        client.startTime = Date.now();

        // CRITICAL: Register ALL event listeners BEFORE initialize()
        // Event: QR Code generated - FAST OPTIMIZATION
        client.on('qr', async (qr) => {
            console.log(`[WhatsApp Web] ⚡ QR Code generated FAST for user ${userId}`);
            console.log(`[WhatsApp Web] QR string length: ${qr ? qr.length : 'null'}`);

            try {
                // FAST: Convert QR to image (optimized)
                console.log(`[WhatsApp Web] Converting QR to image...`);
                const qrImage = await qrcode.toDataURL(qr, {
                    errorCorrectionLevel: 'M',
                    type: 'image/png',
                    quality: 0.92,
                    margin: 1,
                    width: 300
                });

                console.log(`[WhatsApp Web] QR image generated, size: ${qrImage ? qrImage.length : 'null'} bytes`);

                // Cache it immediately
                userQrCodes.set(userId, qrImage);

                // FAST: Send to frontend via Socket.IO immediately
                console.log(`[WhatsApp Web] Sending QR to room: user-${userId}`);
                io.to(`user-${userId}`).emit('qr-code', qrImage);
                console.log(`[WhatsApp Web] ✅ QR code sent to frontend FAST for user ${userId}`);
            } catch (error) {
                console.error('[WhatsApp Web] ❌ Error generating QR code:', error);
                console.error('[WhatsApp Web] Error stack:', error.stack);
            }
        });

        // Event: Authentication successful
        client.on('authenticated', () => {
            console.log(`[WhatsApp Web] User ${userId} authenticated`);
            io.to(`user-${userId}`).emit('authenticated');
            userQrCodes.delete(userId); // Clear QR on auth
        });

        // Event: Client ready
        client.on('ready', async () => {
            console.log(`[WhatsApp Web] Client ready for user ${userId}`);
            userQrCodes.delete(userId); // Ensure cleared

            try {
                // Get phone number
                const phoneNumber = client.info.wid.user;

                // Save session to database
                await pool.query(
                    `INSERT INTO whatsapp_sessions (user_id, phone_number, is_active, last_sync) 
                 VALUES ($1, $2, true, NOW())
                 ON CONFLICT (user_id) DO UPDATE SET 
                 phone_number = $2, is_active = true, last_sync = NOW()`,
                    [userId, phoneNumber]
                );

                io.to(`user-${userId}`).emit('ready', { phoneNumber });
            } catch (error) {
                console.error('[WhatsApp Web] Error in ready event:', error);
            }
        });

        // Event: New message received
        client.on('message', async (message) => {
            console.log(`[WhatsApp Web] New message for user ${userId}`);

            try {
                // Save to database
                await saveMessage(userId, message);

                // Send to frontend
                io.to(`user-${userId}`).emit('new-message', formatMessage(message));
            } catch (error) {
                console.error('[WhatsApp Web] Error handling message:', error);
            }
        });

        // Event: Disconnected (after initialization)
        client.on('disconnected', async (reason) => {
            console.log(`[WhatsApp Web] User ${userId} disconnected:`, reason);
            activeClients.delete(userId);
            userQrCodes.delete(userId);

            try {
                await pool.query(
                    'UPDATE whatsapp_sessions SET is_active = false WHERE user_id = $1',
                    [userId]
                );
            } catch (error) {
                console.error('[WhatsApp Web] Error updating session status:', error);
            }

            io.to(`user-${userId}`).emit('disconnected');
        });

        // CRITICAL: Add remote_session event (for session issues)
        client.on('remote_session_saved', () => {
            console.log(`[WhatsApp Web] ✅ Remote session saved for user ${userId}`);
        });

        // Event: Authentication failure
        client.on('auth_failure', (msg) => {
            console.error(`[WhatsApp Web] Authentication failure for user ${userId}:`, msg);
            io.to(`user-${userId}`).emit('auth-failure', { message: msg });
            userQrCodes.delete(userId);
        });

        // FAST: Initialize the client with comprehensive event listeners
        console.log(`[WhatsApp Web] ⚡ Starting FAST initialization for user ${userId}...`);
        
        // CRITICAL: These listeners are already registered above, but add loading_screen here too
        // (Some versions need it registered before initialize)
        client.on('loading_screen', (percent, message) => {
            console.log(`[WhatsApp Web] 📊 Loading: ${percent}% - ${message || 'Loading...'}`);
        });

        client.on('change_state', (state) => {
            console.log(`[WhatsApp Web] 🔄 State changed: ${state}`);
        });

        // Initialize with comprehensive error handling
        console.log(`[WhatsApp Web] 🚀 Calling client.initialize()...`);
        const initPromise = client.initialize();
        
        initPromise.then(() => {
            console.log(`[WhatsApp Web] ✅ Client initialized successfully for user ${userId}`);
        }).catch(err => {
            console.error(`[WhatsApp Web] ❌ Initialization FAILED for user ${userId}:`);
            console.error(`[WhatsApp Web] Error message: ${err.message}`);
            console.error(`[WhatsApp Web] Error stack:`, err.stack);
            console.error(`[WhatsApp Web] Full error:`, err);
            
            // EMIT ERROR SO FRONTEND KNOWS TO RETRY
            io.to(`user-${userId}`).emit('init-error', { 
                message: err.message || 'Initialization failed',
                details: err.toString()
            });
            
            // Cleanup
            try {
                if (activeClients.has(userId)) {
                    const failedClient = activeClients.get(userId);
                    if (failedClient && failedClient.destroy) {
                        failedClient.destroy().catch(() => {});
                    }
                }
            } catch (cleanupErr) {
                console.error(`[WhatsApp Web] Cleanup error:`, cleanupErr);
            }
            
            activeClients.delete(userId);
            initializingUsers.delete(userId);
            userQrCodes.delete(userId);
        });

        // Add timeout to detect stuck initialization
        setTimeout(() => {
            if (activeClients.has(userId)) {
                const checkClient = activeClients.get(userId);
                if (checkClient && !checkClient.info && !userQrCodes.has(userId)) {
                    console.error(`[WhatsApp Web] ⚠️ TIMEOUT: No QR code after 45s for user ${userId}`);
                    console.error(`[WhatsApp Web] Client state:`, {
                        hasInfo: !!checkClient.info,
                        startTime: checkClient.startTime,
                        elapsed: Date.now() - checkClient.startTime,
                        hasPupPage: !!checkClient.pupPage
                    });
                    
                    // Try to get more info
                    if (checkClient.pupPage) {
                        checkClient.pupPage.url().then(url => {
                            console.log(`[WhatsApp Web] Puppeteer page URL: ${url}`);
                        }).catch(() => {});
                    }
                    
                    // Emit timeout error to frontend
                    io.to(`user-${userId}`).emit('init-error', { 
                        message: 'QR code generation timeout. Please try again.',
                        details: 'Initialization took longer than 45 seconds'
                    });
                }
            }
        }, 45000); // 45 second timeout

        activeClients.set(userId, client);
        initializingUsers.delete(userId);
        
        // Add timeout check - if no QR after 30 seconds, log warning
        setTimeout(() => {
            if (!userQrCodes.has(userId) && activeClients.has(userId)) {
                const client = activeClients.get(userId);
                if (client && !client.info) {
                    console.warn(`[WhatsApp Web] ⚠️ No QR code after 30s for user ${userId}. Client state:`, {
                        hasInfo: !!client.info,
                        startTime: client.startTime,
                        elapsed: Date.now() - client.startTime
                    });
                }
            }
        }, 30000);

        return client;

    } catch (error) {
        console.error(`[WhatsApp Web] Error initializing client for user ${userId}:`, error);
        initializingUsers.delete(userId);
        userQrCodes.delete(userId);
        throw error;
    }
}

/**
 * Sync all chat history for a user
 */
async function syncChatHistory(userId, io) {
    const client = activeClients.get(userId);

    if (!client) {
        throw new Error('WhatsApp client not initialized');
    }

    console.log(`[WhatsApp Web] Starting chat sync for user ${userId}`);

    // WAIT for client to fully load storage (critical fix for empty sync)
    console.log('[WhatsApp Web] Waiting for client resources...');

    // Poll for window.Store (max 10s)
    let resourcesReady = false;
    for (let i = 0; i < 20; i++) {
        try {
            if (client.pupPage) {
                const ready = await client.pupPage.evaluate(() => typeof window.Store !== 'undefined');
                if (ready) {
                    resourcesReady = true;
                    console.log('[WhatsApp Web] Client resources ready.');
                    break;
                }
            }
        } catch (e) {
            // ignore error during polling
        }
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    if (!resourcesReady) {
        console.log('[WhatsApp Web] Timeout waiting for resources, proceeding anyway...');
    }

    try {
        // Get all chats with retry logic and page reload fallback
        let chats = [];
        let retries = 5;

        // Helper to check for window.Store
        const isStoreReady = async () => {
            return await client.pupPage.evaluate(() => {
                return typeof window.Store !== 'undefined';
            });
        };

        while (retries > 0) {
            try {
                if (!client.pupPage) throw new Error('Puppeteer page not attached');

                chats = await client.getChats();
                console.log(`[WhatsApp Web] Successfully fetched ${chats.length} chats`);
                break; // Success
            } catch (err) {
                console.warn(`[WhatsApp Web] getChats failed, retrying (${retries} left)...`, err.message);

                // If it's the specific "undefined" error, try to reload the page
                if (err.message.includes('Cannot read properties of undefined') || err.message.includes('Evaluation failed')) {
                    console.log('[WhatsApp Web] Attempting to fix "undefined" error by reloading page...');
                    try {
                        await client.pupPage.reload();
                        await new Promise(r => setTimeout(r, 10000)); // Wait for reload
                    } catch (reloadErr) {
                        console.error('[WhatsApp Web] Reload failed:', reloadErr);
                    }
                } else {
                    await new Promise(resolve => setTimeout(resolve, 5000));
                }

                retries--;
                if (retries === 0) throw err;
            }
        }

        // Notify frontend about total chats
        io.to(`user-${userId}`).emit('sync-progress', {
            stage: 'starting',
            current: 0,
            total: chats.length
        });

        let totalMessages = 0;

        // Process each chat and extract contact names
        let contactCount = 0;
        for (let i = 0; i < chats.length; i++) {
            const chat = chats[i];

            try {
                // Extract contact number
                const contactNumber = chat.id.user || chat.id._serialized.split('@')[0];
                const contactName = chat.name || chat.pushname || null;

                // Save chat metadata
                await pool.query(
                    `INSERT INTO whatsapp_chats (user_id, chat_id, contact_number, is_group, group_name, last_message_time)
                     VALUES ($1, $2, $3, $4, $5, $6)
                     ON CONFLICT (user_id, chat_id) DO UPDATE SET
                     last_message_time = $6, group_name = $5`,
                    [
                        userId,
                        chat.id._serialized,
                        contactNumber,
                        chat.isGroup,
                        chat.name,
                        chat.lastMessage ? new Date(chat.lastMessage.timestamp * 1000) : null
                    ]
                );

                // Save contact name from chat (if not a group)
                if (!chat.isGroup && contactNumber) {
                    try {
                        await pool.query(
                            `INSERT INTO whatsapp_contacts (user_id, contact_number, contact_name, profile_pic_url)
                             VALUES ($1, $2, $3, $4)
                             ON CONFLICT (user_id, contact_number) DO UPDATE SET
                             contact_name = COALESCE(NULLIF($3, ''), whatsapp_contacts.contact_name),
                             profile_pic_url = COALESCE(NULLIF($4, ''), whatsapp_contacts.profile_pic_url)`,
                            [userId, contactNumber, contactName, chat.profilePicUrl || null]
                        );
                        if (contactName) contactCount++;
                    } catch (contactError) {
                        console.error(`[WhatsApp Web] Error saving contact for ${contactNumber}:`, contactError);
                    }
                }

                // Fetch messages (limit to last 100 per chat to avoid overload)
                const messages = await chat.fetchMessages({ limit: 100 });
                console.log(`[WhatsApp Web] Chat ${i + 1}/${chats.length}: ${messages.length} messages`);

                // Save each message
                for (const message of messages) {
                    await saveMessage(userId, message);
                    totalMessages++;
                }

                // Update progress
                io.to(`user-${userId}`).emit('sync-progress', {
                    stage: 'chats',
                    current: i + 1,
                    total: chats.length,
                    messages: totalMessages
                });
            } catch (error) {
                console.error(`[WhatsApp Web] Error processing chat ${i + 1}:`, error);
            }
        }

        // Try to sync additional contacts (optional - may fail due to WhatsApp API changes)
        console.log('[WhatsApp Web] Attempting to sync additional contacts...');
        try {
            const contacts = await client.getContacts();
            console.log(`[WhatsApp Web] Found ${contacts.length} contacts from getContacts()`);

            for (const contact of contacts) {
                if (contact.isMyContact || contact.isUser) {
                    try {
                        await pool.query(
                            `INSERT INTO whatsapp_contacts (user_id, contact_number, contact_name, profile_pic_url)
                             VALUES ($1, $2, $3, $4)
                             ON CONFLICT (user_id, contact_number) DO UPDATE SET
                             contact_name = COALESCE(NULLIF($3, ''), whatsapp_contacts.contact_name),
                             profile_pic_url = COALESCE(NULLIF($4, ''), whatsapp_contacts.profile_pic_url)`,
                            [userId, contact.id.user, contact.name || contact.pushname || null, contact.profilePicUrl || null]
                        );
                        contactCount++;
                    } catch (error) {
                        console.error('[WhatsApp Web] Error saving contact:', error);
                    }
                }
            }
        } catch (contactError) {
            console.warn('[WhatsApp Web] getContacts() failed (this is normal with WhatsApp updates):', contactError.message);
            console.log('[WhatsApp Web] Using contact names extracted from chats instead');
        }

        // Update last sync time
        await pool.query(
            'UPDATE whatsapp_sessions SET last_sync = NOW() WHERE user_id = $1',
            [userId]
        );

        // FAST: Emit sync complete immediately
        io.to(`user-${userId}`).emit('sync-complete', {
            chats: chats.length,
            messages: totalMessages,
            contacts: contactCount
        });

        console.log(`[WhatsApp Web] ✅ FAST Sync complete for user ${userId} - ${chats.length} chats, ${totalMessages} messages, ${contactCount} contacts`);
    } catch (error) {
        console.error('[WhatsApp Web] Error during sync:', error);
        io.to(`user-${userId}`).emit('sync-error', { message: error.message });
        throw error;
    }
}

/**
 * Save a message to database
 */
async function saveMessage(userId, message) {
    try {
        // Extract contact info from message
        const senderNumber = message.fromMe ? null : (message.author || message.from || '').split('@')[0];
        const contactName = message.notifyName || message._data?.notifyName || null;

        await pool.query(
            `INSERT INTO whatsapp_web_messages 
             (user_id, message_id, chat_id, sender, message_text, message_type, is_from_me, timestamp)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (message_id) DO NOTHING`,
            [
                userId,
                message.id._serialized,
                message.id.remote, // CORRECT: Use remote ID as chat_id (works for both sent/received)
                message.author || message.from,
                message.body || '',
                message.type,
                message.fromMe,
                new Date(message.timestamp * 1000)
            ]
        );

        // Update contact name from message if available
        if (senderNumber && contactName && !message.fromMe) {
            try {
                await pool.query(
                    `INSERT INTO whatsapp_contacts (user_id, contact_number, contact_name)
                     VALUES ($1, $2, $3)
                     ON CONFLICT (user_id, contact_number) DO UPDATE SET
                     contact_name = COALESCE(NULLIF($3, ''), whatsapp_contacts.contact_name)`,
                    [userId, senderNumber, contactName]
                );
            } catch (contactError) {
                // Ignore contact update errors
            }
        }
    } catch (error) {
        console.error('[WhatsApp Web] Error saving message:', error);
    }
}

/**
 * Format message for frontend
 */
function formatMessage(message) {
    return {
        id: message.id._serialized,
        from: message.from,
        body: message.body,
        type: message.type,
        timestamp: message.timestamp,
        fromMe: message.fromMe
    };
}

/**
 * Get client for user
 */
function getClient(userId) {
    return activeClients.get(userId);
}

/**
 * Check if client is ready
 */
function isClientReady(userId) {
    const client = activeClients.get(userId);
    return client ? client.info !== undefined : false;
}

/**
 * Send message via WhatsApp Web
 */
async function sendMessage(userId, phoneNumber, messageText) {
    const client = activeClients.get(userId);

    if (!client) {
        throw new Error('WhatsApp client not initialized');
    }

    if (!isClientReady(userId)) {
        throw new Error('WhatsApp client not ready');
    }

    try {
        // Format phone number (remove + and ensure it's in correct format)
        let formattedNumber = phoneNumber.replace(/[^0-9]/g, '');
        if (!formattedNumber.includes('@')) {
            formattedNumber = `${formattedNumber}@c.us`;
        }

        // Send message
        const message = await client.sendMessage(formattedNumber, messageText);

        // Save message to database
        await saveMessage(userId, message);

        return message;
    } catch (error) {
        console.error('[WhatsApp Web] Error sending message:', error);
        throw error;
    }
}

/**
 * Disconnect client
 */
async function disconnectClient(userId) {
    const client = activeClients.get(userId);
    if (client) {
        try {
            await client.destroy();
            activeClients.delete(userId);

            // Wait for process to fully exit
            await new Promise(resolve => setTimeout(resolve, 1000));

            // FORCE CLEANUP: Delete session data to ensure fresh QR on next connect
            const fs = require('fs');
            const path = require('path');
            const sessionPath = path.join(__dirname, '.wwebjs_auth', `session-${userId}`);

            if (fs.existsSync(sessionPath)) {
                console.log(`[WhatsApp Web] Wiping session data for user ${userId}...`);
                try {
                    fs.rmSync(sessionPath, { recursive: true, force: true });
                } catch (rmErr) {
                    console.error('[WhatsApp Web] Error deleting session files (ignoring):', rmErr.message);
                }
            }

            // Mark session as inactive
            await pool.query(
                'UPDATE whatsapp_sessions SET is_active = false WHERE user_id = $1',
                [userId]
            );
            console.log(`[WhatsApp Web] Client disconnected and session wiped for user ${userId}`);
            io.to(`user-${userId}`).emit('disconnected'); // Notify frontend
        } catch (error) {
            console.error('[WhatsApp Web] Error disconnecting client:', error);
        }
    }
}

module.exports = {
    initializeClient,
    syncChatHistory,
    getClient,
    isClientReady,
    disconnectClient,
    sendMessage,
    activeClients
};
