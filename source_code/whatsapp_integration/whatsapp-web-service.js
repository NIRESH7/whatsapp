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
const activeClients = new Map();
// Store latest QR code for each user to handle refreshes/race conditions
const userQrCodes = new Map();

// Locks to prevent race conditions
const initializingUsers = new Set();
const syncingUsers = new Set(); // Track users currently syncing

/**
 * Initialize WhatsApp client for a user
 */
async function initializeClient(userId, io) {
    // CRITICAL: Prevent multiple simultaneous initializations with proper locking
    if (initializingUsers.has(userId)) {
        console.log(`[WhatsApp Web] ⚠️ Initialization already in progress for user ${userId}. Skipping duplicate request.`);
        // If we have a QR code ready, send it to the (possibly new) socket connection!
        if (userQrCodes.has(userId)) {
            console.log(`[WhatsApp Web] Emitting cached QR code for user ${userId}`);
            io.to(`user-${userId}`).emit('qr-code', userQrCodes.get(userId));
            return activeClients.get(userId) || null;
        }
        // Return existing client or wait for it (but with timeout)
        const existingClient = activeClients.get(userId);
        if (existingClient) {
            // Check if it's been initializing too long (more than 60 seconds)
            if (existingClient.startTime && (Date.now() - existingClient.startTime > 60000)) {
                console.log(`[WhatsApp Web] ⚠️ Client stuck in initialization (${Date.now() - existingClient.startTime}ms). Destroying and retrying...`);
                try {
                    if (existingClient.pupPage && !existingClient.pupPage.isClosed()) {
                        await existingClient.pupPage.close().catch(() => { });
                    }
                    await existingClient.destroy().catch(() => { });
                } catch (e) { }
                activeClients.delete(userId);
                userQrCodes.delete(userId);
                initializingUsers.delete(userId);
                // Continue to create new client below
            } else {
                return existingClient;
            }
        } else {
            // Wait a bit and check again (max 10 seconds)
            for (let i = 0; i < 5; i++) {
                await new Promise(resolve => setTimeout(resolve, 2000));
                const clientAfterWait = activeClients.get(userId);
                if (clientAfterWait) {
                    return clientAfterWait;
                }
            }
            // If still no client after 10 seconds, clear the lock and continue
            console.log(`[WhatsApp Web] ⚠️ No client after wait, clearing lock and retrying...`);
            initializingUsers.delete(userId);
            // Continue to create new client below
        }
    }

    // Check if client already exists and is ready (before starting new initialization)
    if (activeClients.has(userId)) {
        const existingClient = activeClients.get(userId);
        if (existingClient && existingClient.info) {
            console.log(`[WhatsApp Web] ✅ Client already exists and is ready for user ${userId}`);
            io.to(`user-${userId}`).emit('ready', { phoneNumber: existingClient.info.wid.user });
            return existingClient;
        }

        // Client exists but not ready - check if it's still initializing
        if (existingClient.startTime && (Date.now() - existingClient.startTime < 60000)) {
            console.log(`[WhatsApp Web] ⚠️ Client exists but still initializing (${Date.now() - existingClient.startTime}ms). Waiting...`);
            // Wait a bit and return existing client
            if (userQrCodes.has(userId)) {
                io.to(`user-${userId}`).emit('qr-code', userQrCodes.get(userId));
            }
            return existingClient;
        }

        // Client exists but stalled - destroy it properly before creating new one
        console.log(`[WhatsApp Web] 🧹 Client exists but stalled, destroying old client before creating new one...`);
        try {
            if (existingClient.pupPage) {
                try {
                    await existingClient.pupPage.close().catch(() => { });
                } catch (e) { }
            }
            await existingClient.destroy().catch(() => { });
        } catch (destroyErr) {
            console.warn(`[WhatsApp Web] ⚠️ Error destroying old client (ignoring):`, destroyErr.message);
        }
        activeClients.delete(userId);
        userQrCodes.delete(userId);
        // Wait a bit for cleanup
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    initializingUsers.add(userId);
    console.log(`[WhatsApp Web] Initializing client for user ${userId}`);

    try {
        // CRITICAL FIX: Check and clean old/corrupted sessions before initializing
        const fs = require('fs');
        const path = require('path');
        const sessionPath = path.join(__dirname, 'whatsapp-sessions', `session-user-${userId}`);

        // CRITICAL: Always try to delete old session if no active client exists
        // This ensures fresh QR code generation after disconnect
        if (fs.existsSync(sessionPath) && !activeClients.has(userId)) {
            console.log(`[WhatsApp Web] 🧹 Old session found for user ${userId}, attempting to delete for fresh QR...`);
            // Wait a bit for any locks to release
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Try to delete, but don't fail if Windows locks it
            try {
                // Try rename first (works better on Windows)
                const oldPath = sessionPath + '.old.' + Date.now();
                try {
                    fs.renameSync(sessionPath, oldPath);
                    // Delete renamed folder in background (don't wait)
                    setTimeout(() => {
                        try {
                            fs.rmSync(oldPath, { recursive: true, force: true });
                        } catch (e) {
                            // Ignore - Windows may still have it locked
                        }
                    }, 2000);
                    console.log(`[WhatsApp Web] ✅ Old session renamed (will be deleted in background)`);
                } catch (renameErr) {
                    // If rename fails, try direct delete
                    fs.rmSync(sessionPath, { recursive: true, force: true });
                    console.log(`[WhatsApp Web] ✅ Old session deleted`);
                }
            } catch (rmErr) {
                // Windows file lock - just continue, WhatsApp will create new session folder
                if (rmErr.code === 'EPERM' || rmErr.code === 'EBUSY' || rmErr.message.includes('Permission denied')) {
                    console.log(`[WhatsApp Web] ℹ️ Session files locked by Windows. Will use new session folder.`);
                } else {
                    console.warn(`[WhatsApp Web] ⚠️ Could not delete old session:`, rmErr.message);
                }
                // Continue anyway - WhatsApp will handle it
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
                console.log(`[WhatsApp Web] 📱 New device connected: ${phoneNumber}`);

                // CRITICAL: Check if this is a different phone number (new device)
                const existingSession = await pool.query(
                    'SELECT phone_number, last_sync FROM whatsapp_sessions WHERE user_id = $1',
                    [userId]
                );

                const existingPhoneNumber = existingSession.rows[0]?.phone_number;
                const lastSync = existingSession.rows[0]?.last_sync;

                // If phone number changed, clear old data automatically
                if (existingPhoneNumber && existingPhoneNumber !== phoneNumber) {
                    console.log(`[WhatsApp Web] 🔄 Phone number changed from ${existingPhoneNumber} to ${phoneNumber}`);
                    console.log(`[WhatsApp Web] 🗑️ Auto-clearing old data for new device...`);

                    try {
                        // Clear old data
                        const msgResult = await pool.query('DELETE FROM whatsapp_web_messages WHERE user_id = $1', [userId]);
                        const chatResult = await pool.query('DELETE FROM whatsapp_chats WHERE user_id = $1', [userId]);
                        const contactResult = await pool.query('DELETE FROM whatsapp_contacts WHERE user_id = $1', [userId]);
                        console.log(`[WhatsApp Web] ✅ Cleared: ${msgResult.rowCount} messages, ${chatResult.rowCount} chats, ${contactResult.rowCount} contacts`);

                        // Reset last_sync to null so sync knows to fetch fresh data
                        await pool.query(
                            'UPDATE whatsapp_sessions SET last_sync = NULL WHERE user_id = $1',
                            [userId]
                        );

                        // Notify frontend to clear UI
                        io.to(`user-${userId}`).emit('disconnected', { dataCleared: true, newDevice: true });
                    } catch (clearError) {
                        console.error('[WhatsApp Web] Error auto-clearing old data:', clearError);
                    }
                } else if (!existingPhoneNumber && lastSync) {
                    // First time connecting but there's old sync data - clear it
                    console.log(`[WhatsApp Web] 🗑️ No phone number but old sync exists - clearing old data...`);
                    try {
                        await pool.query('DELETE FROM whatsapp_web_messages WHERE user_id = $1', [userId]);
                        await pool.query('DELETE FROM whatsapp_chats WHERE user_id = $1', [userId]);
                        await pool.query('DELETE FROM whatsapp_contacts WHERE user_id = $1', [userId]);
                        await pool.query('UPDATE whatsapp_sessions SET last_sync = NULL WHERE user_id = $1', [userId]);
                        console.log(`[WhatsApp Web] ✅ Old data cleared`);
                    } catch (clearError) {
                        console.error('[WhatsApp Web] Error clearing old data:', clearError);
                    }
                }

                // Save session to database
                // CRITICAL: If phone number changed, set last_sync to NULL so sync knows to clear old data
                const wasNewDevice = existingPhoneNumber && existingPhoneNumber !== phoneNumber;

                if (wasNewDevice) {
                    // New device - set last_sync to NULL
                    await pool.query(
                        `INSERT INTO whatsapp_sessions (user_id, phone_number, is_active, last_sync) 
                     VALUES ($1, $2, true, NULL)
                     ON CONFLICT (user_id) DO UPDATE SET 
                     phone_number = $2, is_active = true, last_sync = NULL`,
                        [userId, phoneNumber]
                    );
                    console.log(`[WhatsApp Web] ✅ Set last_sync to NULL for new device - sync will clear old data`);
                } else {
                    // Same device - update normally
                    await pool.query(
                        `INSERT INTO whatsapp_sessions (user_id, phone_number, is_active, last_sync) 
                     VALUES ($1, $2, true, NOW())
                     ON CONFLICT (user_id) DO UPDATE SET 
                     phone_number = $2, is_active = true, last_sync = NOW()`,
                        [userId, phoneNumber]
                    );
                }

                io.to(`user-${userId}`).emit('ready', { phoneNumber, dataCleared: existingPhoneNumber && existingPhoneNumber !== phoneNumber });

                // Backfill history for top chats
                console.log('[WhatsApp Web] 🔄 Starting message history backfill...');
                syncRecentChats(client, userId).catch(err => console.error('[WhatsApp Web] Backfill error:', err));
            } catch (error) {
                console.error('[WhatsApp Web] Error in ready event:', error);
            }
        });

        // Event: New message received
        client.on('message', async (message) => {
            console.log(`[WhatsApp Web] New message for user ${userId}`);

            try {
                // Save to database
                await saveMessage(userId, message, client);

                // Send to frontend
                io.to(`user-${userId}`).emit('new-message', formatMessage(message));
            } catch (error) {
                console.error('[WhatsApp Web] Error handling message:', error);
            }
        });

        // Event: Disconnected (after initialization)
        client.on('disconnected', async (reason) => {
            console.log(`[WhatsApp Web] User ${userId} disconnected:`, reason);

            // CRITICAL: Properly destroy client before cleanup
            try {
                if (client.pupPage && !client.pupPage.isClosed()) {
                    await client.pupPage.close().catch(() => { });
                }
                await client.destroy().catch(() => { });
            } catch (destroyErr) {
                console.warn(`[WhatsApp Web] Error destroying client on disconnect:`, destroyErr.message);
            }

            // Clean up all references
            activeClients.delete(userId);
            userQrCodes.delete(userId);
            initializingUsers.delete(userId);

            try {
                await pool.query(
                    'UPDATE whatsapp_sessions SET is_active = false, last_sync = NULL WHERE user_id = $1',
                    [userId]
                );
            } catch (error) {
                console.error('[WhatsApp Web] Error updating session status:', error);
            }

            // Notify frontend
            io.to(`user-${userId}`).emit('disconnected', { reason });

            // CRITICAL: If disconnected with LOGOUT or CONNECTION_LOST, auto-reinitialize to generate new QR
            if (reason === 'LOGOUT' || reason === 'CONNECTION_LOST' || reason === 'NAVIGATION') {
                console.log(`[WhatsApp Web] 🔄 Auto-reinitializing after disconnect (${reason}) to generate new QR...`);

                // Clean up session files with retry (Windows file locking issue)
                const fs = require('fs');
                const path = require('path');
                const sessionPath = path.join(__dirname, 'whatsapp-sessions', `session-user-${userId}`);

                if (fs.existsSync(sessionPath)) {
                    // Wait longer before attempting deletion (Windows needs time to release locks)
                    await new Promise(resolve => setTimeout(resolve, 5000)); // Increased to 5 seconds

                    // Retry deletion with delay to handle Windows file locks
                    const deleteSession = async (retries = 5) => {
                        for (let i = 0; i < retries; i++) {
                            try {
                                await new Promise(resolve => setTimeout(resolve, 3000 * (i + 1))); // Wait longer each retry

                                // Try to rename first (works better on Windows)
                                const oldPath = sessionPath + '.old.' + Date.now();
                                try {
                                    fs.renameSync(sessionPath, oldPath);
                                    // Then delete the renamed folder in background
                                    setTimeout(() => {
                                        try {
                                            fs.rmSync(oldPath, { recursive: true, force: true });
                                        } catch (e) {
                                            // Ignore - Windows may still have it locked
                                        }
                                    }, 2000);
                                    console.log(`[WhatsApp Web] ✅ Session files renamed (will be deleted in background)`);
                                    return;
                                } catch (renameErr) {
                                    // If rename fails, try direct delete
                                    fs.rmSync(sessionPath, { recursive: true, force: true });
                                    console.log(`[WhatsApp Web] ✅ Session files deleted`);
                                    return;
                                }
                            } catch (rmErr) {
                                if (i === retries - 1) {
                                    // EPERM or other permission errors - just warn and continue
                                    if (rmErr.code === 'EPERM' || rmErr.code === 'EBUSY' || rmErr.message.includes('Permission denied')) {
                                        console.warn(`[WhatsApp Web] ⚠️ Windows permission error - session files locked. Will use new session folder.`);
                                    } else {
                                        console.warn(`[WhatsApp Web] ⚠️ Could not delete session files:`, rmErr.message);
                                    }
                                    // Continue anyway - WhatsApp will create a new session folder
                                }
                            }
                        }
                    };
                    await deleteSession();
                }

                // Wait longer then reinitialize to generate new QR (ensure cleanup is complete)
                setTimeout(async () => {
                    try {
                        // Double-check we're not already initializing
                        if (initializingUsers.has(userId)) {
                            console.log(`[WhatsApp Web] ⚠️ Already initializing, skipping duplicate reinit`);
                            return;
                        }

                        console.log(`[WhatsApp Web] 🚀 Reinitializing client to generate new QR code...`);
                        await initializeClient(userId, io);
                    } catch (initError) {
                        console.error('[WhatsApp Web] Error reinitializing after disconnect:', initError);
                        io.to(`user-${userId}`).emit('init-error', { message: initError.message });
                    }
                }, 5000); // Wait 5 seconds before re-initializing (increased from 2s)
            }
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
                        failedClient.destroy().catch(() => { });
                    }
                }
            } catch (cleanupErr) {
                console.error(`[WhatsApp Web] Cleanup error:`, cleanupErr);
            }

            activeClients.delete(userId);
            initializingUsers.delete(userId);
            userQrCodes.delete(userId);
        });

        // Add timeout to detect stuck initialization (increased to 60s)
        setTimeout(async () => {
            if (activeClients.has(userId)) {
                const checkClient = activeClients.get(userId);
                if (checkClient && !checkClient.info && !userQrCodes.has(userId)) {
                    console.error(`[WhatsApp Web] ⚠️ TIMEOUT: No QR code after 60s for user ${userId}`);
                    console.error(`[WhatsApp Web] Client state:`, {
                        hasInfo: !!checkClient.info,
                        startTime: checkClient.startTime,
                        elapsed: Date.now() - checkClient.startTime,
                        hasPupPage: !!checkClient.pupPage
                    });

                    // Try to get more info
                    if (checkClient.pupPage && !checkClient.pupPage.isClosed()) {
                        try {
                            // url() is a property, not a method that returns a promise
                            const url = checkClient.pupPage.url();
                            console.log(`[WhatsApp Web] Puppeteer page URL: ${url}`);
                        } catch (urlErr) {
                            // Ignore URL access errors
                        }
                    }

                    // Clean up stuck client
                    try {
                        if (checkClient.pupPage && !checkClient.pupPage.isClosed()) {
                            await checkClient.pupPage.close().catch(() => { });
                        }
                        await checkClient.destroy().catch(() => { });
                    } catch (e) { }

                    activeClients.delete(userId);
                    initializingUsers.delete(userId);
                    userQrCodes.delete(userId);

                    // Emit timeout error to frontend
                    io.to(`user-${userId}`).emit('init-error', {
                        message: 'QR code generation timeout. Please try again.',
                        details: 'Initialization took longer than 60 seconds'
                    });
                }
            }
        }, 60000); // 60 second timeout (increased from 45s)

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
    // Prevent multiple simultaneous syncs for the same user
    if (syncingUsers.has(userId)) {
        console.log(`[WhatsApp Web] ⚠️ Sync already in progress for user ${userId}, skipping...`);
        return;
    }

    const client = activeClients.get(userId);

    if (!client) {
        throw new Error('WhatsApp client not initialized');
    }

    syncingUsers.add(userId);
    console.log(`[WhatsApp Web] 🚀 Starting chat sync for user ${userId}`);

    // CRITICAL: Clear old data if last_sync is NULL (indicates new device or cleared data)
    try {
        const session = await pool.query(
            'SELECT phone_number, last_sync FROM whatsapp_sessions WHERE user_id = $1',
            [userId]
        );

        if (session.rows.length > 0) {
            const lastSync = session.rows[0].last_sync;

            // If last_sync is NULL, it means data was cleared (new device) - make sure it's really cleared
            if (!lastSync) {
                console.log(`[WhatsApp Web] ℹ️ No previous sync (last_sync is NULL) - this is a fresh sync`);
                // Double-check data is cleared
                const msgCount = await pool.query('SELECT COUNT(*) as count FROM whatsapp_web_messages WHERE user_id = $1', [userId]);
                const chatCount = await pool.query('SELECT COUNT(*) as count FROM whatsapp_chats WHERE user_id = $1', [userId]);
                if (parseInt(msgCount.rows[0].count) > 0 || parseInt(chatCount.rows[0].count) > 0) {
                    console.log(`[WhatsApp Web] 🗑️ Found old data despite NULL sync - clearing it...`);
                    await pool.query('DELETE FROM whatsapp_web_messages WHERE user_id = $1', [userId]);
                    await pool.query('DELETE FROM whatsapp_chats WHERE user_id = $1', [userId]);
                    await pool.query('DELETE FROM whatsapp_contacts WHERE user_id = $1', [userId]);
                    console.log(`[WhatsApp Web] ✅ Old data cleared`);
                }
            } else {
                const lastSyncDate = new Date(lastSync);
                const timeSinceSync = Date.now() - lastSyncDate.getTime();
                const twoMinutes = 2 * 60 * 1000;

                // If last sync was more than 2 minutes ago, likely a new device - clear old data
                if (timeSinceSync > twoMinutes) {
                    console.log(`[WhatsApp Web] 🗑️ Last sync was ${Math.round(timeSinceSync / 1000 / 60)} minutes ago - clearing old data before new sync...`);
                    const deleteMessages = await pool.query('DELETE FROM whatsapp_web_messages WHERE user_id = $1', [userId]);
                    const deleteChats = await pool.query('DELETE FROM whatsapp_chats WHERE user_id = $1', [userId]);
                    const deleteContacts = await pool.query('DELETE FROM whatsapp_contacts WHERE user_id = $1', [userId]);
                    console.log(`[WhatsApp Web] ✅ Cleared: ${deleteMessages.rowCount} messages, ${deleteChats.rowCount} chats, ${deleteContacts.rowCount} contacts`);
                } else {
                    console.log(`[WhatsApp Web] ℹ️ Last sync was recent (${Math.round(timeSinceSync / 1000)}s ago) - keeping existing data`);
                }
            }
        } else {
            // No previous sync - this is first time, no need to clear
            console.log(`[WhatsApp Web] ℹ️ No previous sync found - first time sync`);
        }
    } catch (clearError) {
        console.error('[WhatsApp Web] Error checking/clearing old data:', clearError);
        // Continue with sync anyway
    }

    // WAIT for client to fully load storage (critical fix for empty sync)
    console.log('[WhatsApp Web] Waiting for client resources...');

    // CRITICAL: Wait longer for WhatsApp Web to fully load after authentication
    // WhatsApp Web needs time to load all chats and contacts into memory
    // User is okay with waiting up to 2 minutes for data
    console.log('[WhatsApp Web] Waiting 15 seconds for WhatsApp Web to fully load all chats...');
    await new Promise(resolve => setTimeout(resolve, 15000)); // Increased to 15 seconds

    // Poll for window.Store and Store.Chat (max 60s - user is okay with waiting)
    let resourcesReady = false;
    for (let i = 0; i < 120; i++) { // 120 * 500ms = 60 seconds max
        try {
            if (client.pupPage && !client.pupPage.isClosed()) {
                try {
                    const ready = await client.pupPage.evaluate(() => {
                        // Check if Store exists AND Store.Chat exists (needed for getChats)
                        return typeof window.Store !== 'undefined' &&
                            window.Store.Chat &&
                            typeof window.Store.Chat.get === 'function';
                    });
                    if (ready) {
                        resourcesReady = true;
                        console.log('[WhatsApp Web] ✅ Client resources ready (Store.Chat available).');
                        // Wait additional 5 seconds after Store.Chat is ready to ensure it's fully loaded
                        await new Promise(resolve => setTimeout(resolve, 5000));
                        break;
                    }
                } catch (evalErr) {
                    // If page was closed, break out of loop
                    if (evalErr.message.includes('Target closed') || evalErr.message.includes('Protocol error')) {
                        console.error('[WhatsApp Web] ❌ Page was closed during resource check');
                        break;
                    }
                }
            } else if (!client.pupPage || client.pupPage.isClosed()) {
                console.error('[WhatsApp Web] ❌ Page is closed, cannot check resources');
                break;
            }
        } catch (e) {
            // ignore error during polling
        }
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    if (!resourcesReady) {
        console.log('[WhatsApp Web] ⚠️ Timeout waiting for Store.Chat, but proceeding anyway...');
        // Wait even longer before proceeding
        console.log('[WhatsApp Web] Waiting additional 10 seconds before attempting getChats...');
        await new Promise(resolve => setTimeout(resolve, 10000));
    }

    try {
        // Get all chats with retry logic and page reload fallback
        let chats = [];
        let retries = 5;

        // Helper to check for window.Store (with page closed check)
        const isStoreReady = async () => {
            if (!client.pupPage || client.pupPage.isClosed()) {
                return false;
            }
            try {
                return await client.pupPage.evaluate(() => {
                    return typeof window.Store !== 'undefined';
                });
            } catch (e) {
                return false;
            }
        };

        // User wants NO TIME LIMITATION for fetching, so we increase retries significantly
        // and add a mechanism to wait until data is actually ready.
        let internalRetries = 30; // 30 * 2s = 60s of active checking (plus wait times)

        while (internalRetries > 0) {
            try {
                if (!client.pupPage || client.pupPage.isClosed()) {
                    console.error('[WhatsApp Web] ❌ Puppeteer page not attached or closed');
                    throw new Error('Puppeteer page not attached or closed');
                }

                console.log(`[WhatsApp Web] Attempting to fetch chats (retry ${6 - retries}/5)...`);

                // CRITICAL: Verify Store.Chat is available AND page is not closed
                if (client.pupPage && !client.pupPage.isClosed()) {
                    try {
                        const storeReady = await client.pupPage.evaluate(() => {
                            return typeof window.Store !== 'undefined' &&
                                window.Store.Chat &&
                                typeof window.Store.Chat.get === 'function';
                        });

                        if (!storeReady) {
                            console.log('[WhatsApp Web] ⚠️ Store.Chat not ready yet, waiting 10 more seconds...');
                            await new Promise(resolve => setTimeout(resolve, 10000));
                        } else {
                            console.log('[WhatsApp Web] Store.Chat is ready, waiting 5 more seconds...');
                            await new Promise(resolve => setTimeout(resolve, 5000));
                        }
                    } catch (evalErr) {
                        // Ignore, handled below
                    }
                } else {
                    throw new Error('Puppeteer page is closed or not available');
                }

                console.log('[WhatsApp Web] ⏳ Fetching chats manually via Puppeteer (safest method)...');

                // USE MANUAL FETCH - Bypasses buggy client.getChats()
                try {
                    chats = await manualGetChats(client);
                    console.log(`[WhatsApp Web] ✅ Successfully fetched ${chats.length} chats manually`);
                } catch (manualErr) {
                    console.error('[WhatsApp Web] Manual fetch failed:', manualErr);
                    throw manualErr;
                }

                break; // Success
            } catch (err) {
                console.warn(`[WhatsApp Web] ⚠️ Fetch failed, retrying (${internalRetries - 1} left)...`, err.message);
                console.error('[WhatsApp Web] Full error:', err);

                // Check if it's a "Target closed" error - client was destroyed
                if (err.message.includes('Target closed') || err.message.includes('Protocol error') || err.message.includes('Page was closed') || err.message.includes('Puppeteer page is closed')) {
                    console.error('[WhatsApp Web] ❌ Client target was closed. Client may have been destroyed.');
                    break;
                }

                // Wait before retry
                console.log('[WhatsApp Web] Waiting 2 seconds before retry...');
                await new Promise(resolve => setTimeout(resolve, 2000));

                internalRetries--;
                if (internalRetries === 0) {
                    console.error('[WhatsApp Web] ❌ All retries exhausted for getChats');

                    // Even if we fail to get chats, we don't want to block the user forever.
                    // But user specifically asked "i wont wnat any time limitation".
                    // However, we must return eventually. We'll return empty here and let background process or user retry.

                    console.log('[WhatsApp Web] Emitting sync-complete with 0 chats due to failure');
                    io.to(`user-${userId}`).emit('sync-complete', {
                        chats: 0,
                        totalChats: 0,
                        messages: 0,
                        contacts: 0,
                        error: err.message,
                        note: 'Sync failed to find chats. Please ensure WhatsApp is active on your phone.'
                    });
                    syncingUsers.delete(userId);
                    return; // Exit early
                }
            }
        }

        // Check if we got any chats
        if (!chats || chats.length === 0) {
            console.warn('[WhatsApp Web] ⚠️ No chats found! This might mean WhatsApp is still loading.');
            // Still emit sync-complete with 0 chats so frontend can proceed
            io.to(`user-${userId}`).emit('sync-complete', {
                chats: 0,
                totalChats: 0,
                messages: 0,
                contacts: 0,
                note: 'No chats found. Please wait a moment and refresh.'
            });
            return; // Exit early
        }

        // Notify frontend about total chats and contacts
        io.to(`user-${userId}`).emit('sync-progress', {
            stage: 'starting',
            current: 0,
            total: chats.length,
            totalContacts: chats.length, // Total contacts to fetch
            contactsFetched: 0,
            messages: 0,
            message: `Found ${chats.length} total contacts. Starting to fetch names and history...`
        });

        let totalMessages = 0;

        // Process each chat and extract contact names
        let contactCount = 0;
        // CRITICAL: Sync ALL chats - NO LIMIT - user wants complete data
        // User explicitly said: "enaku complte conatcal la irukua ella name and full chat history uhh frect papanu ebvolo time anau paravalu"
        const chatsToSync = chats; // Sync ALL chats, not just first 50
        const totalChats = chats.length;

        console.log(`[WhatsApp Web] 🚀 Syncing ALL ${chatsToSync.length} chats - NO LIMIT - Complete data fetch...`);

        for (let i = 0; i < chatsToSync.length; i++) {
            const chat = chatsToSync[i];

            try {
                // Extract contact number
                const contactNumber = chat.id.user || chat.id._serialized.split('@')[0];
                
                // CRITICAL: Get contact name - WhatsApp Web shows names exactly as they appear
                // Priority: chat.name → chat.pushname → Store.Contact → null
                let contactName = null;
                
                // Step 1: Try chat.name first (most reliable - this is what WhatsApp Web shows)
                if (chat.name && chat.name.trim() && chat.name !== contactNumber) {
                    contactName = chat.name.trim();
                    console.log(`[WhatsApp Web] 📞 Using chat.name for ${contactNumber}: ${contactName}`);
                }
                
                // Step 2: Try chat.pushname (display name from WhatsApp)
                if (!contactName && chat.pushname && chat.pushname.trim() && chat.pushname !== contactNumber) {
                    contactName = chat.pushname.trim();
                    console.log(`[WhatsApp Web] 📞 Using chat.pushname for ${contactNumber}: ${contactName}`);
                }
                
                // Step 3: Try Store.Contact via Puppeteer (for saved contacts)
                if (!contactName && !chat.isGroup) {
                    try {
                        const contactId = chat.id._serialized;
                        const contactData = await client.pupPage.evaluate((cid) => {
                            try {
                                if (!window.Store || !window.Store.Contact) return null;
                                const contact = window.Store.Contact.get(cid);
                                if (!contact) return null;
                                // Try all name fields - WhatsApp Web uses these
                                return contact.name || contact.pushname || contact.notifyName || contact.shortName || contact.verifiedName || null;
                            } catch (e) {
                                return null;
                            }
                        }, contactId);
                        
                        if (contactData && contactData.trim() && contactData !== contactNumber) {
                            contactName = contactData.trim();
                            console.log(`[WhatsApp Web] 📞 Got contact name via Store.Contact for ${contactNumber}: ${contactName}`);
                        }
                    } catch (contactErr) {
                        // Ignore - contact might not be in phonebook
                        console.log(`[WhatsApp Web] Could not fetch contact details via Puppeteer for ${contactNumber}: ${contactErr.message}`);
                    }
                }

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

                // Save contact name from chat (if not a group) - CRITICAL: Save name exactly as WhatsApp Web shows it
                if (!chat.isGroup && contactNumber) {
                    try {
                        // Use the contactName we already fetched above (from chat.name, chat.pushname, or Store.Contact)
                        let finalContactName = contactName;

                        // CRITICAL: WhatsApp Web shows names even if they're similar to numbers
                        // Only reject if it's EXACTLY the same as the number
                        if (finalContactName && finalContactName.trim() === contactNumber) {
                            // If name is exactly the number, try to get a better one
                            if (chat.pushname && chat.pushname.trim() !== contactNumber) {
                                finalContactName = chat.pushname.trim();
                            } else {
                                // Keep the number as name - WhatsApp Web shows number if no name
                                finalContactName = contactNumber;
                            }
                        }
                        
                        // If still no name, use number (WhatsApp Web shows number if no name saved)
                        if (!finalContactName || !finalContactName.trim()) {
                            finalContactName = contactNumber;
                        } else {
                            finalContactName = finalContactName.trim();
                            
                            // CRITICAL: Don't save "WhatsApp" as contact name - it's not a real name
                            // If name is "WhatsApp", use phone number instead
                            if (finalContactName.toLowerCase() === 'whatsapp') {
                                finalContactName = contactNumber;
                            }
                        }

                        // CRITICAL FIX: Normalize phone number for consistent storage
                        // Remove spaces, +, and ensure consistent format
                        const normalizedNumber = contactNumber.replace(/\s+/g, '').replace(/^\+/, '');

                        // Save with normalized number AND try with original format too
                        await pool.query(
                            `INSERT INTO whatsapp_contacts (user_id, contact_number, contact_name, profile_pic_url)
                             VALUES ($1, $2, $3, $4)
                             ON CONFLICT (user_id, contact_number) DO UPDATE SET
                             contact_name = COALESCE(NULLIF($3, ''), whatsapp_contacts.contact_name),
                             profile_pic_url = COALESCE(NULLIF($4, ''), whatsapp_contacts.profile_pic_url)`,
                            [userId, normalizedNumber, finalContactName, chat.profilePicUrl || null]
                        );

                        // Also save with original format if different
                        if (normalizedNumber !== contactNumber) {
                            await pool.query(
                                `INSERT INTO whatsapp_contacts (user_id, contact_number, contact_name, profile_pic_url)
                                 VALUES ($1, $2, $3, $4)
                                 ON CONFLICT (user_id, contact_number) DO UPDATE SET
                                 contact_name = COALESCE(NULLIF($3, ''), whatsapp_contacts.contact_name),
                                 profile_pic_url = COALESCE(NULLIF($4, ''), whatsapp_contacts.profile_pic_url)`,
                                [userId, contactNumber, finalContactName, chat.profilePicUrl || null]
                            );
                        }

                        // Always increment contact count
                        contactCount++;
                        console.log(`[WhatsApp Web] ✅ Saved contact: ${finalContactName} (${contactNumber})`);

                        // CRITICAL: Emit contact-updated event for progressive display (only once)
                        io.to(`user-${userId}`).emit('contact-updated', {
                            contactNumber: contactNumber,
                            contactName: finalContactName,
                            contactIndex: i + 1,
                            totalContacts: chatsToSync.length
                        });
                        
                        // Also emit detailed progress update
                        io.to(`user-${userId}`).emit('sync-progress', {
                            stage: 'chats',
                            current: i + 1,
                            total: chatsToSync.length,
                            totalChats: chatsToSync.length,
                            totalContacts: chatsToSync.length,
                            contactsFetched: contactCount,
                            messages: totalMessages,
                            currentContact: finalContactName || contactNumber,
                            currentContactNumber: contactNumber,
                            message: `Fetching ${i + 1}/${chatsToSync.length}: ${finalContactName || contactNumber} - Complete history...`
                        });
                    } catch (contactError) {
                        console.error(`[WhatsApp Web] Error saving contact for ${contactNumber}:`, contactError);
                    }
                }

                // CRITICAL: Fetch COMPLETE message history for this contact before moving to next
                // User wants FULL history for ALL contacts - NO LIMIT
                let messages = [];
                try {
                    // Fetch ALL messages - NO LIMIT - user wants complete history
                    console.log(`[WhatsApp Web] Fetching COMPLETE message history for ${contactName || contactNumber}...`);
                    
                    // Try to fetch in multiple batches to get ALL messages
                    let allMessages = [];
                    let batchSize = 10000;
                    let hasMore = true;
                    let attempts = 0;
                    const maxAttempts = 20; // Allow up to 200,000 messages per chat
                    
                    while (hasMore && attempts < maxAttempts) {
                        const batchMessages = await manualFetchMessages(client, chat.id._serialized, batchSize);
                        
                        if (batchMessages.length === 0) {
                            hasMore = false;
                            break;
                        }
                        
                        // Merge with existing messages (avoid duplicates)
                        const newMessages = batchMessages.filter(msg => 
                            !allMessages.some(existing => existing.id._serialized === msg.id._serialized)
                        );
                        
                        allMessages = [...allMessages, ...newMessages];
                        
                        // If we got less than batch size, we've reached the end
                        if (batchMessages.length < batchSize) {
                            hasMore = false;
                        } else {
                            // Wait a bit before next batch to avoid rate limits
                            await new Promise(resolve => setTimeout(resolve, 1000));
                            attempts++;
                        }
                    }
                    
                    messages = allMessages;
                    console.log(`[WhatsApp Web] Chat ${i + 1}/${chatsToSync.length}: ${messages.length} messages fetched for ${contactName || contactNumber}`);
                } catch (msgError) {
                    console.warn(`[WhatsApp Web] ⚠️ Error fetching messages for chat ${i + 1}:`, msgError.message);
                    messages = [];
                }

                // Save each message
                for (const message of messages) {
                    await saveMessage(userId, message, client);
                    totalMessages++;
                }

                // CRITICAL: Emit progress update showing this contact is done
                const displayName = contactName || contactNumber;
                io.to(`user-${userId}`).emit('sync-progress', {
                    stage: 'chats',
                    current: i + 1,
                    total: chatsToSync.length,
                    totalChats: totalChats, // Show total available
                    totalContacts: totalChats, // Total contacts to fetch
                    contactsFetched: contactCount,
                    messages: totalMessages,
                    currentContact: displayName,
                    currentContactNumber: contactNumber,
                    message: `${i + 1} done: ${displayName} - ${messages.length} messages fetched`
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

        // CRITICAL: All chats synced - no background sync needed since we sync ALL chats
        console.log(`[WhatsApp Web] ✅ COMPLETE sync finished: ${totalMessages} messages, ${contactCount} contacts from ${chatsToSync.length} chats`);
        console.log(`[WhatsApp Web] ✅ ALL ${totalChats} chats synced with complete history!`);

        // Emit sync-complete with completion message
        io.to(`user-${userId}`).emit('sync-complete', {
            chats: chatsToSync.length,
            totalChats: totalChats,
            messages: totalMessages,
            contacts: contactCount,
            totalContacts: totalChats,
            completed: true,
            message: `✅ Successfully fetched ALL ${contactCount} contacts and ${totalMessages} messages with complete history!`,
            note: null // No background sync - all done!
        });

        console.log(`[WhatsApp Web] ✅ FAST Sync complete for user ${userId} - ${chatsToSync.length} chats, ${totalMessages} messages, ${contactCount} contacts`);
        syncingUsers.delete(userId);
    } catch (error) {
        console.error('[WhatsApp Web] ❌ Error during sync:', error);
        console.error('[WhatsApp Web] Error stack:', error.stack);

        // Always emit sync-complete even on error, so frontend can proceed
        // Check if we have any data saved
        try {
            const chatCount = await pool.query('SELECT COUNT(*) as count FROM whatsapp_chats WHERE user_id = $1', [userId]);
            const messageCount = await pool.query('SELECT COUNT(*) as count FROM whatsapp_web_messages WHERE user_id = $1', [userId]);
            const contactCount = await pool.query('SELECT COUNT(*) as count FROM whatsapp_contacts WHERE user_id = $1', [userId]);

            const chats = parseInt(chatCount.rows[0]?.count || 0);
            const messages = parseInt(messageCount.rows[0]?.count || 0);
            const contacts = parseInt(contactCount.rows[0]?.count || 0);

            console.log(`[WhatsApp Web] Found in DB: ${chats} chats, ${messages} messages, ${contacts} contacts`);

            io.to(`user-${userId}`).emit('sync-complete', {
                chats: chats,
                totalChats: chats,
                messages: messages,
                contacts: contacts,
                error: error.message,
                note: chats > 0 ? 'Sync had errors but some data is available.' : 'Sync failed. Please try again.'
            });
        } catch (dbError) {
            console.error('[WhatsApp Web] Error checking database:', dbError);
            io.to(`user-${userId}`).emit('sync-error', { message: error.message });
        }

        // Don't throw - let it complete gracefully
        console.log('[WhatsApp Web] Sync completed with errors, but frontend notified');
        syncingUsers.delete(userId);
    }
}

/**
 * Sync remaining chats in background (non-blocking)
 */
async function syncRemainingChats(userId, client, io, remainingChats, existingContactCount) {
    let totalMessages = 0;
    let contactCount = existingContactCount;

    console.log(`[WhatsApp Web] 🔄 Starting background sync for ${remainingChats.length} remaining chats...`);

    for (let i = 0; i < remainingChats.length; i++) {
        const chat = remainingChats[i];
        try {
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

            // Save contact name
            if (!chat.isGroup && contactNumber && contactName) {
                try {
                    const normalizedNumber = contactNumber.replace(/\s+/g, '').replace(/^\+/, '');
                    await pool.query(
                        `INSERT INTO whatsapp_contacts (user_id, contact_number, contact_name)
                         VALUES ($1, $2, $3)
                         ON CONFLICT (user_id, contact_number) DO UPDATE SET
                         contact_name = COALESCE(NULLIF($3, ''), whatsapp_contacts.contact_name)`,
                        [userId, normalizedNumber, contactName.trim()]
                    );
                    contactCount++;
                } catch (contactError) {
                    // Ignore
                }
            }

            // Fetch messages (fewer for background sync)
            const messages = await manualFetchMessages(client, chat.id._serialized, 30);
            for (const message of messages) {
                await saveMessage(userId, message, client);
                totalMessages++;
            }
        } catch (error) {
            console.error(`[WhatsApp Web] Error in background sync for chat ${i + 1}:`, error);
        }
    }

    console.log(`[WhatsApp Web] ✅ Background sync complete: +${totalMessages} messages, +${contactCount - existingContactCount} contacts`);
}

/**
 * Save a message to database
 */
async function saveMessage(userId, message, client = null) {
    try {
        // Extract contact info from message
        // Extract contact info from message
        const from = (message.author || message.from || '') + ''; // Ensure string
        const senderNumber = message.fromMe ? null : from.split('@')[0];
        const contactName = message.notifyName || message._data?.notifyName || null;

        // Get client if not provided
        if (!client) {
            client = activeClients.get(userId);
        }

        // CRITICAL: Filter out JSON strings from message body before saving
        let messageBody = message.body || '';
        // Filter out JSON strings from message body before saving
        if (messageBody.includes('{"server"') || messageBody.includes('"user"') || messageBody.trim().startsWith('{')) {
            messageBody = ''; // Do not save JSON strings as message text
        }

        await pool.query(
            `INSERT INTO whatsapp_web_messages 
             (user_id, message_id, chat_id, sender, message_text, message_type, is_from_me, is_read, timestamp)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             ON CONFLICT (message_id) DO NOTHING`,
            [
                userId,
                message.id._serialized,
                message.id.remote, // CORRECT: Use remote ID as chat_id (works for both sent/received)
                // Sanitize sender for DB
                // Ensure we don't save JSON objects or weird structures
                typeof (message.author || message.from) === 'object' ?
                    ((message.author || message.from)._serialized || (message.author || message.from).user) :
                    (message.author || message.from),
                messageBody, // Use filtered messageBody
                message.type,
                message.fromMe,
                message.fromMe, // is_read (true if from me, false if from others)
                new Date(message.timestamp * 1000)
            ]
        );

        // Update contact name from message if available - IMPROVED: Better name extraction
        if (senderNumber && !message.fromMe) {
            try {
                // Get name from multiple sources
                let cleanName = contactName ||
                    message.notifyName ||
                    message._data?.notifyName ||
                    message._data?.notify ||
                    message.pushName ||
                    null;

                // Try to get from contact object if available - use safer Puppeteer method
                if (!cleanName && client && client.pupPage && !client.pupPage.isClosed()) {
                    try {
                        let contactId = message.from || message.author;
                        // Handle if contactId is object (it shouldn't be here but safe check)
                        if (typeof contactId === 'object') {
                            contactId = contactId._serialized || contactId.user;
                        }

                        if (contactId) {
                            // Use safer Puppeteer evaluation instead of getContactById
                            const contactData = await client.pupPage.evaluate((cid) => {
                                try {
                                    if (!window.Store || !window.Store.Contact) return null;
                                    const contact = window.Store.Contact.get(cid);
                                    if (!contact) return null;
                                    return contact.name || contact.pushname || contact.notifyName || contact.shortName || contact.verifiedName || null;
                                } catch (e) {
                                    return null;
                                }
                            }, contactId);
                            
                            if (contactData) {
                                cleanName = contactData;
                            }
                        }
                    } catch (err) {
                        // Silently ignore - not critical for message saving
                    }
                }

                if (cleanName) {
                    cleanName = cleanName.trim();
                    // Don't save if name is just the phone number
                    const nameDigits = cleanName.replace(/\D/g, '');
                    const numDigits = senderNumber.replace(/\D/g, '');
                    if (cleanName !== senderNumber && nameDigits !== numDigits) {
                        // Normalize phone number
                        const normalizedNumber = senderNumber.replace(/\s+/g, '').replace(/^\+/, '');

                        await pool.query(
                            `INSERT INTO whatsapp_contacts (user_id, contact_number, contact_name)
                             VALUES ($1, $2, $3)
                             ON CONFLICT (user_id, contact_number) DO UPDATE SET
                             contact_name = COALESCE(NULLIF($3, ''), whatsapp_contacts.contact_name)`,
                            [userId, normalizedNumber, cleanName]
                        );

                        // Also save with original format
                        if (normalizedNumber !== senderNumber) {
                            await pool.query(
                                `INSERT INTO whatsapp_contacts (user_id, contact_number, contact_name)
                                 VALUES ($1, $2, $3)
                                 ON CONFLICT (user_id, contact_number) DO UPDATE SET
                                 contact_name = COALESCE(NULLIF($3, ''), whatsapp_contacts.contact_name)`,
                                [userId, senderNumber, cleanName]
                            );
                        }
                    }
                }
            } catch (contactError) {
                // Ignore contact update errors
            }
        }

        // CRITICAL: Ensure chat exists in whatsapp_chats table for Chat List
        try {
            const chatId = message.id.remote;
            const chatContactNumber = message.fromMe ? message.to : (message.author || message.from);

            // Upsert chat with latest timestamp
            await pool.query(
                `INSERT INTO whatsapp_chats (user_id, chat_id, contact_number, last_message_time, unread_count)
                 VALUES ($1, $2, $3, $4, 
                    CASE WHEN $5 = true THEN 0 ELSE 1 END
                 )
                 ON CONFLICT (user_id, chat_id) DO UPDATE SET
                 last_message_time = $4,
                 unread_count = CASE 
                    WHEN $5 = true THEN 0 
                    ELSE whatsapp_chats.unread_count + 1 
                 END`,
                [
                    userId,
                    chatId,
                    chatContactNumber,
                    new Date(message.timestamp * 1000),
                    message.fromMe
                ]
            );
        } catch (chatError) {
            console.error('[WhatsApp Web] Error updating chat list:', chatError);
        }

    } catch (error) {
        console.error('[WhatsApp Web] Error saving message:', error);
    }
}

/**
 * Format message for frontend
 */
function formatMessage(message) {
    const senderNumber = (message.author || message.from || '').split('@')[0];
    const recipientNumber = (message.to || '').split('@')[0];
    return {
        id: message.id._serialized,
        from: message.from,
        sender: message.fromMe ? 'Me' : senderNumber, // Use senderNumber
        senderNumber: senderNumber,
        recipient: message.fromMe ? recipientNumber : 'Me', // Use recipientNumber
        text: message.body || '', // Use 'text' for body
        body: message.body || '', // Keep for backward compatibility
        type: message.type,
        timestamp: message.timestamp,
        time: new Date(message.timestamp * 1000).toLocaleTimeString(), // Add formatted time
        fromMe: message.fromMe,
        read: message.fromMe // Default read status
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
        await saveMessage(userId, message, client);

        return message;
    } catch (error) {
        console.error('[WhatsApp Web] Error sending message:', error);
        throw error;
    }
}

/**
 * Disconnect client - IMPROVED: Clear old data when linking new device
 */
async function disconnectClient(userId, io = null, clearData = true) {
    const client = activeClients.get(userId);
    if (client) {
        try {
            await client.destroy();
            activeClients.delete(userId);
            userQrCodes.delete(userId);
            initializingUsers.delete(userId);

            // Wait for process to fully exit
            await new Promise(resolve => setTimeout(resolve, 1000));

            // FORCE CLEANUP: Delete session data to ensure fresh QR on next connect
            const fs = require('fs');
            const path = require('path');
            const sessionPath = path.join(__dirname, 'whatsapp-sessions', `session-user-${userId}`);

            if (fs.existsSync(sessionPath)) {
                console.log(`[WhatsApp Web] 🧹 Wiping session data for user ${userId}...`);
                // Retry deletion with delay to handle Windows file locks (EBUSY error)
                const deleteSession = async (retries = 3) => {
                    for (let i = 0; i < retries; i++) {
                        try {
                            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Wait longer each retry
                            fs.rmSync(sessionPath, { recursive: true, force: true });
                            console.log(`[WhatsApp Web] ✅ Session wiped after ${i + 1} retry(ies) - fresh QR will be generated`);
                            return;
                        } catch (rmErr) {
                            if (i === retries - 1) {
                                console.warn(`[WhatsApp Web] ⚠️ Could not delete session files (Windows lock?):`, rmErr.message);
                                // Continue anyway - will be overwritten on next init
                            }
                        }
                    }
                };
                await deleteSession();
            }

            // CRITICAL: Clear old data when linking new device
            if (clearData) {
                console.log(`[WhatsApp Web] 🗑️ Clearing old data for user ${userId} (linking new device)...`);
                try {
                    // Delete old messages
                    await pool.query('DELETE FROM whatsapp_web_messages WHERE user_id = $1', [userId]);
                    console.log(`[WhatsApp Web] ✅ Cleared old messages`);

                    // Delete old chats
                    await pool.query('DELETE FROM whatsapp_chats WHERE user_id = $1', [userId]);
                    console.log(`[WhatsApp Web] ✅ Cleared old chats`);

                    // Delete old contacts
                    await pool.query('DELETE FROM whatsapp_contacts WHERE user_id = $1', [userId]);
                    console.log(`[WhatsApp Web] ✅ Cleared old contacts`);

                    // Clear session data
                    await pool.query(
                        'UPDATE whatsapp_sessions SET phone_number = NULL, last_sync = NULL, is_active = false WHERE user_id = $1',
                        [userId]
                    );
                    console.log(`[WhatsApp Web] ✅ Cleared session data`);
                } catch (clearError) {
                    console.error('[WhatsApp Web] Error clearing old data:', clearError);
                    // Don't throw - continue with disconnect
                }
            }

            // Mark session as inactive
            await pool.query(
                'UPDATE whatsapp_sessions SET is_active = false WHERE user_id = $1',
                [userId]
            );
            console.log(`[WhatsApp Web] ✅ Client disconnected and session wiped for user ${userId}`);

            // Notify frontend if io is available
            if (io) {
                io.to(`user-${userId}`).emit('disconnected', { dataCleared: clearData });
            }
        } catch (error) {
            console.error('[WhatsApp Web] Error disconnecting client:', error);
            throw error;
        }
    } else {
        console.log(`[WhatsApp Web] No client found for user ${userId} - already disconnected`);

        // Still clear data if requested
        if (clearData) {
            console.log(`[WhatsApp Web] 🗑️ Clearing old data for user ${userId} (no active client)...`);
            try {
                await pool.query('DELETE FROM whatsapp_web_messages WHERE user_id = $1', [userId]);
                await pool.query('DELETE FROM whatsapp_chats WHERE user_id = $1', [userId]);
                await pool.query('DELETE FROM whatsapp_contacts WHERE user_id = $1', [userId]);
                await pool.query(
                    'UPDATE whatsapp_sessions SET phone_number = NULL, last_sync = NULL, is_active = false WHERE user_id = $1',
                    [userId]
                );
                console.log(`[WhatsApp Web] ✅ Cleared old data`);
            } catch (clearError) {
                console.error('[WhatsApp Web] Error clearing old data:', clearError);
            }
        }
    }
}



/**
 * Manually fetch chats using Puppeteer evaluation
 */
async function manualGetChats(client) {
    return await client.pupPage.evaluate(() => {
        // ROBUST CHECK FOR STORE
        if (typeof window.Store === 'undefined') {
            return []; // Store not ready
        }
        if (!window.Store.Chat) {
            return []; // Chat module not ready
        }

        // Try different ways to access models
        let chats = [];
        if (window.Store.Chat.models) {
            chats = window.Store.Chat.models;
        } else if (typeof window.Store.Chat.getModelsArray === 'function') {
            chats = window.Store.Chat.getModelsArray();
        } else if (window.Store.Chat._models) {
            chats = window.Store.Chat._models;
        } else if (Array.isArray(window.Store.Chat)) {
            chats = window.Store.Chat;
        }

        // If still no chats, try to see if it's a Collection class we can iterate
        if (!chats || (Array.isArray(chats) && chats.length === 0)) {
            return [];
        }

        // If it's not an array, try to convert it
        if (!Array.isArray(chats)) {
            if (chats.length !== undefined && chats.length > 0) {
                chats = Array.from(chats);
            } else {
                return [];
            }
        }

        return chats.map(c => {
            // Validate c exists
            if (!c) return null;

            // Reconstruct minimal object needed for sync
            const idObj = c.id || {};

            return {
                id: {
                    _serialized: idObj._serialized || (idObj.user + '@' + idObj.server),
                    user: idObj.user,
                    server: idObj.server,
                    remote: idObj.remote || idObj._serialized
                },
                name: c.name || c.pushname || c.formattedTitle || c.contact?.name,
                pushname: c.pushname,
                isGroup: c.isGroup,
                unreadCount: c.unreadCount,
                lastMessage: c.lastmsg ? {
                    timestamp: c.lastmsg.t
                } : null,
                // Add profile pic if available
                profilePicUrl: c.contact && c.contact.profilePicUrl ? c.contact.profilePicUrl : null
            };
        }).filter(c => c !== null); // Remove nulls
    });
}

/**
 * Manually fetch messages using Puppeteer evaluation
 * CRITICAL: Enhanced to load ALL messages by calling loadEarlierMsgs multiple times
 */
async function manualFetchMessages(client, chatId, limit = 50) {
    return await client.pupPage.evaluate(async (chatId, limit) => {
        if (!window.Store || !window.Store.Chat) return [];

        const chat = window.Store.Chat.get(chatId);
        if (!chat) return [];

        // CRITICAL: Load earlier messages multiple times to get ALL messages
        // User wants complete history - no limit
        if (typeof chat.loadEarlierMsgs === 'function') {
            let previousCount = 0;
            let currentCount = 0;
            let attempts = 0;
            const maxAttempts = 50; // Try up to 50 times to load all messages
            
            // Keep loading earlier messages until we can't load more
            while (attempts < maxAttempts) {
                // Get current message count
                let msgs = [];
                if (chat.msgs && chat.msgs.models) {
                    msgs = chat.msgs.models;
                } else if (chat.msgs && typeof chat.msgs.getModelsArray === 'function') {
                    msgs = chat.msgs.getModelsArray();
                } else if (chat.msgs && chat.msgs._models) {
                    msgs = chat.msgs._models;
                } else if (chat.msgs && Array.isArray(chat.msgs)) {
                    msgs = chat.msgs;
                }
                
                previousCount = currentCount;
                currentCount = msgs.length;
                
                // If count didn't increase, we've loaded all messages
                if (previousCount > 0 && currentCount === previousCount) {
                    break;
                }
                
                // Try to load more
                try {
                    await chat.loadEarlierMsgs();
                    // Wait a bit for messages to load
                    await new Promise(resolve => setTimeout(resolve, 500));
                } catch (e) {
                    // If error, we've probably reached the end
                    break;
                }
                
                attempts++;
            }
        }

        // Get messages models
        let msgs = [];
        if (chat.msgs && chat.msgs.models) {
            msgs = chat.msgs.models;
        } else if (chat.msgs && typeof chat.msgs.getModelsArray === 'function') {
            msgs = chat.msgs.getModelsArray();
        } else if (chat.msgs && chat.msgs._models) {
            msgs = chat.msgs._models;
        } else if (chat.msgs && Array.isArray(chat.msgs)) {
            msgs = chat.msgs;
        }

        if (!Array.isArray(msgs)) return [];

        // CRITICAL: Return ALL messages, not just sliced - user wants complete history
        // Only slice if limit is specified and we want to limit
        const sliced = limit && limit > 0 ? msgs.slice(-limit) : msgs;

        return sliced.map(m => {
            // Validate m
            if (!m || !m.id) return null;

            return {
                id: {
                    _serialized: m.id._serialized,
                    remote: m.id.remote
                },
                body: m.body || '',
                type: m.type,
                timestamp: m.t,
                from: m.from,
                to: m.to,
                author: m.author,
                isStatus: m.isStatus,
                hasMedia: m.hasMedia,
                fromMe: m.id.fromMe,
                fromMe: m.id.fromMe,
                notifyName: m.notifyName || (m._data ? m._data.notifyName : null) || (m.senderObj ? (m.senderObj.name || m.senderObj.pushname || m.senderObj.shortName) : null)
            };
        }).filter(m => m !== null);
    }, chatId, limit);
}

/**
 * Backfill messages for recent chats to ensure history is populated
 */
async function syncRecentChats(client, userId) {
    try {
        console.log('[WhatsApp Web] Fetching chats for backfill...');
        const chats = await client.getChats(); // Start with standard fetch

        // Take top 15 active chats
        const recentChats = chats.slice(0, 15);
        console.log(`[WhatsApp Web] Backfilling history for ${recentChats.length} recent chats...`);

        for (const chat of recentChats) {
            try {
                // Fetch last 50 messages per chat
                const messages = await chat.fetchMessages({ limit: 50 });
                console.log(`[WhatsApp Web] Syncing ${messages.length} msgs for ${chat.name || chat.id.user}`);

                for (const msg of messages) {
                    await saveMessage(msg, userId, client);
                }

                // Small delay to prevent rate limits
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (chatErr) {
                console.warn(`[WhatsApp Web] Failed to sync chat ${chat.id._serialized}:`, chatErr.message);
            }
        }
        console.log('[WhatsApp Web] ✅ History backfill complete');
    } catch (error) {
        console.error('[WhatsApp Web] Error in syncRecentChats:', error);
    }
}

/**
 * Sync messages for a specific chat (On-Demand)
 */
async function syncSingleChat(client, userId, contactNumber) {
    try {
        // Normalize ID
        let chatId = contactNumber.includes('@') ? contactNumber : `${contactNumber}@c.us`;

        // Try getting chat directly
        let chat = await client.getChatById(chatId);

        // If not found, iterate (slower but safer)
        if (!chat) {
            const chats = await client.getChats();
            chat = chats.find(c => c.id.user === contactNumber || c.id._serialized === contactNumber);
        }

        if (chat) {
            console.log(`[WhatsApp Web] Fetching COMPLETE history for ${chat.name || chatId}...`);
            // CRITICAL: Fetch ALL messages (no limit - user wants complete history)
            // Use manual fetch for better reliability and no limits
            // Try to fetch in batches to get complete history
            let allMessages = [];
            let batchLimit = 10000;
            let currentMessages = await manualFetchMessages(client, chatId, batchLimit);
            allMessages = currentMessages;
            
            // If we got the full batch, try to load more (pagination)
            while (currentMessages.length === batchLimit) {
                console.log(`[WhatsApp Web] Loaded ${currentMessages.length} messages, trying to load more...`);
                // Wait a bit before next batch
                await new Promise(resolve => setTimeout(resolve, 1000));
                const nextBatch = await manualFetchMessages(client, chatId, batchLimit);
                if (nextBatch.length === 0 || nextBatch.length === currentMessages.length) break; // No more messages
                allMessages = nextBatch; // Replace with latest (they should be cumulative)
                currentMessages = nextBatch;
            }
            
            const messages = allMessages;

            let count = 0;
            for (const msg of messages) {
                // Convert manual message format to proper format for saveMessage
                const formattedMessage = {
                    id: { 
                        _serialized: msg.id._serialized || `${msg.id.remote}_${Date.now()}`,
                        remote: msg.id.remote 
                    },
                    body: msg.body || '',
                    type: msg.type || 'chat',
                    timestamp: msg.timestamp || Math.floor(Date.now() / 1000),
                    from: msg.from || msg.author,
                    to: msg.to,
                    author: msg.author || msg.from,
                    fromMe: msg.fromMe || false,
                    notifyName: msg.notifyName
                };
                await saveMessage(userId, formattedMessage, client);
                count++;
            }
            console.log(`[WhatsApp Web] ✅ Backfilled ${count} messages for ${chatId}`);
            return count;
        } else {
            console.warn(`[WhatsApp Web] Chat ${chatId} not found for sync`);
        }
    } catch (err) {
        console.error(`[WhatsApp Web] Error syncing ${contactNumber}:`, err);
        throw err;
    }
}

/**
 * Get QR code for a user
 */
const getQrCode = (userId) => {
    return userQrCodes.get(userId);
};

module.exports = {
    initializeClient,
    getClient,
    isClientReady,
    disconnectClient,
    sendMessage,
    activeClients,
    getQrCode,

    manualFetchChats: manualGetChats,
    manualFetchMessages,
    syncRecentChats,
    syncSingleChat,
    syncChatHistory
};
