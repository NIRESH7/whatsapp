import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './WhatsAppConnect.css';

export default function WhatsAppConnect() {
    const [qrCode, setQrCode] = useState<string | null>(null);
    const [status, setStatus] = useState<string>('Connecting to server...');
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [syncProgress, setSyncProgress] = useState<any>(null);
    const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
    const [showQRButton, setShowQRButton] = useState(true); // Keeping for fallback
    const [isInitializing, setIsInitializing] = useState(false);
    const [socketConnected, setSocketConnected] = useState(false);
    const [userId, setUserId] = useState<number | null>(null);
    const socketRef = useRef<Socket | null>(null);
    const navigate = useNavigate();
    const [showFetchingModal, setShowFetchingModal] = useState(false);

    // Auto-init ref to prevent double firing
    const hasAutoInitialized = useRef(false);

    useEffect(() => {
        // Ensure credentials are sent with requests
        axios.defaults.withCredentials = true;

        // Fetch current user (but allow default user 1 if not logged in)
        axios.get('http://localhost:3000/api/current_user')
            .then(res => {
                if (res.data && res.data.id) {
                    setUserId(res.data.id);
                    console.log('[WhatsApp Connect] Logged in as user:', res.data.id);
                } else {
                    // Use default user 1 if not logged in
                    setUserId(1);
                    console.log('[WhatsApp Connect] Using default user 1');
                }
            })
            .catch(err => {
                console.error('[WhatsApp Connect] Auth check failed, using default user 1:', err);
                // Use default user 1 if auth fails
                setUserId(1);
            });
    }, []);

    useEffect(() => {
        if (!userId) return; // Wait for user ID

        // Initialize socket connection
        const socket = io('http://localhost:3000', {
            withCredentials: true, // IMPORTANT: Send cookies with socket handshake
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000
        });

        socketRef.current = socket;

        // Handle socket connection
        socket.on('connect', () => {
            console.log('[WhatsApp Connect] Socket connected:', socket.id);
            setSocketConnected(true);
            socket.emit('join-room', userId);
            
            // FAST: Auto-check if already connected and has QR cached
            axios.get('http://localhost:3000/api/whatsapp-web/status', {
                withCredentials: true
            }).then(res => {
                if (res.data.ready) {
                    setStatus('✅ Already connected! Redirecting...');
                    setTimeout(() => navigate('/chat'), 1000);
                } else if (res.data.connected && !res.data.ready) {
                    setStatus('🔄 Reconnecting...');
                }
            }).catch(() => {});
        });

        socket.on('connect_error', (error) => {
            console.error('[WhatsApp Connect] Socket connection error:', error);
            setStatus('❌ Failed to connect to server. Make sure the backend is running on port 3000.');
            setIsInitializing(false);
            setSocketConnected(false);
        });

        socket.on('disconnect', (reason) => {
            console.log('[WhatsApp Connect] Socket disconnected:', reason);
            setSocketConnected(false);
            if (reason === 'io server disconnect') {
                socket.connect();
            }
        });

        // Listen for QR code - FAST DISPLAY
        socket.on('qr-code', (qrImage: string) => {
            console.log('[WhatsApp Connect] QR Code received - FAST!');
            setQrCode(qrImage);
            setStatus('📱 Scan QR code with your phone');
            setShowQRButton(false);
            setIsInitializing(false);
        });

        // Listen for authentication
        socket.on('authenticated', () => {
            console.log('[WhatsApp Connect] Authenticated!');
            setStatus('Authenticated! Connecting...');
            setIsAuthenticated(true);
        });

        // Listen for ready - FAST SYNC
        socket.on('ready', async (data: any) => {
            console.log('[WhatsApp Connect] WhatsApp Web ready:', data);
            
            // If data was cleared (new device), show message
            if (data.dataCleared) {
                setStatus(`✅ New device connected! Old data cleared. Starting fast sync...`);
            } else {
                setStatus(`✅ Connected! Starting fast sync...`);
            }
            
            setPhoneNumber(data.phoneNumber);
            setQrCode(null);
            setIsAuthenticated(true);

            // FAST: Auto-start sync immediately with timeout fallback
            try {
                console.log('[WhatsApp Connect] Starting fast sync...');
                setStatus(`🔄 Fetching your chats and contacts...`);
                
                // Set a timeout to redirect even if sync is slow
                const syncTimeout = setTimeout(() => {
                    console.log('[WhatsApp Connect] Sync timeout - redirecting anyway...');
                    setStatus('✅ Data loaded! Redirecting to chat...');
                    setTimeout(() => navigate('/chat'), 1000);
                }, 150000); // 150 second max wait (2.5 minutes - user is okay with waiting)
                
                // Clear timeout when sync completes
                const originalSyncComplete = socket.listeners('sync-complete')[0];
                socket.off('sync-complete');
                socket.once('sync-complete', (syncData: any) => {
                    clearTimeout(syncTimeout);
                    if (originalSyncComplete) {
                        originalSyncComplete(syncData);
                    }
                });
                
                // Start sync (don't await - let it run in background)
                axios.post('http://localhost:3000/api/whatsapp-web/sync', {}, {
                    withCredentials: true,
                    timeout: 55000 // 55 second timeout
                }).catch(err => {
                    clearTimeout(syncTimeout);
                    console.error('[WhatsApp Connect] Sync error:', err);
                    setStatus('⚠️ Sync had issues, but redirecting to chat...');
                    setTimeout(() => navigate('/chat'), 2000);
                });
            } catch (err: any) {
                console.error('[WhatsApp Connect] Sync error:', err);
                setStatus('⚠️ Error starting sync, redirecting...');
                setTimeout(() => navigate('/chat'), 2000);
            }
        });

        // Listen for sync progress - FAST UPDATES
        socket.on('sync-progress', (progress: any) => {
            setSyncProgress(progress);
            // Keep modal open during sync
            if (!showFetchingModal) {
                setShowFetchingModal(true);
            }
            
            const totalContacts = progress.totalContacts || progress.total || 0;
            const contactsFetched = progress.contactsFetched || progress.current || 0;
            const messagesFetched = progress.messages || 0;
            
            if (progress.total > 0) {
                const percent = Math.round((progress.current / progress.total) * 100);
                setStatus(`🔄 Fetching data... ${contactsFetched}/${totalContacts} contacts, ${messagesFetched} messages (${percent}%) - Please wait, this may take up to 2 minutes...`);
            } else if (totalContacts > 0) {
                setStatus(`🔄 Preparing to fetch ${totalContacts} contacts from your mobile... This may take up to 2 minutes, please wait...`);
            } else {
                setStatus('🔄 Preparing to fetch your data... This may take up to 2 minutes, please wait...');
            }
        });

        // Listen for sync complete - FAST REDIRECT
        socket.on('sync-complete', (data: any) => {
            console.log('[WhatsApp Connect] ✅ Sync complete - FAST!', data);
            const chatsCount = data.chats || 0;
            const messagesCount = data.messages || 0;
            const contactsCount = data.contacts || 0;
            const totalChats = data.totalChats || chatsCount;
            const totalContacts = data.totalContacts || totalChats;
            
            // Close fetching modal
            setShowFetchingModal(false);
            
            // Show completion message
            if (data.message) {
                setStatus(`✅ ${data.message}`);
            } else if (data.note) {
                setStatus(`✅ Fetched ${chatsCount} chats (${totalChats} total), ${messagesCount} messages, ${contactsCount} contacts! More loading in background...`);
            } else {
                setStatus(`✅ You have completed fetched ${contactsCount} contacts and ${messagesCount} messages!`);
            }
            setSyncProgress(null);

            // Show completion message for 2 seconds, then redirect
            setTimeout(() => {
                console.log('[WhatsApp Connect] Redirecting to chat page...');
                navigate('/chat');
            }, 2000); // 2 seconds to show completion message
        });

        // Listen for sync error
        socket.on('sync-error', (error: any) => {
            console.error('[WhatsApp Connect] Sync error:', error);
            // Even if sync errors (e.g. non-critical), we might want to redirect if we have data
            setStatus(`Note: Sync incomplete (${error.message}). Redirecting...`);
            setTimeout(() => {
                navigate('/chat');
            }, 2000);
        });

        // Listen for disconnection
        socket.on('disconnected', (data: any) => {
            console.log('[WhatsApp Connect] Disconnected', data);
            setStatus('Disconnected. Preparing new session...');
            setIsAuthenticated(false);
            setQrCode(null);
            setShowQRButton(true);
            setPhoneNumber(null);
            hasAutoInitialized.current = false; // Allow auto-init again

            // CRITICAL: Auto-trigger init after disconnect to generate new QR
            console.log('[WhatsApp Connect] Auto-triggering QR generation after disconnect...');
            setTimeout(() => {
                handleGenerateQR();
            }, 2000); // Wait 2 seconds for cleanup
        });

        socket.on('auth-failure', (data: any) => {
            console.error('[WhatsApp Connect] Auth failure:', data);
            setStatus(`❌ Authentication failed: ${data.message}`);
            setQrCode(null);
            setShowQRButton(true);
            setIsInitializing(false);
        });

        socket.on('init-error', (data: any) => {
            console.error('[WhatsApp Connect] Init error:', data);
            setStatus(`❌ Initialization failed: ${data.message}. Retrying...`);
            setIsInitializing(false);
            setQrCode(null);
            setShowQRButton(true);
            hasAutoInitialized.current = false;

            // Auto-retry in 5s
            setTimeout(() => handleGenerateQR(), 5000);
        });

        return () => {
            socket.removeAllListeners();
            socket.disconnect();
        };
    }, [navigate, userId]);

    // Auto-generate QR Logic - FIXED: Make sure it triggers
    useEffect(() => {
        if (socketConnected && userId && !isAuthenticated && !qrCode && !isInitializing && !phoneNumber && !hasAutoInitialized.current) {
            console.log('[WhatsApp Connect] ⚡ Auto-triggering QR generation...');
            // Small delay to ensure socket is fully ready
            setTimeout(() => {
                handleGenerateQR();
            }, 500);
        }
    }, [socketConnected, userId, isAuthenticated, qrCode, isInitializing, phoneNumber]);

    const handleGenerateQR = async () => {
        if (isInitializing) return; // Prevent double-click

        try {
            setIsInitializing(true);
            hasAutoInitialized.current = true;
            setShowQRButton(false);
            setStatus('⚡ Generating QR code...'); // Fast status

            // FAST: Initialize WhatsApp Web client (non-blocking)
            const response = await axios.post('http://localhost:3000/api/whatsapp-web/init', {}, {
                withCredentials: true,
                timeout: 10000 // 10s timeout for faster feedback
            });
            console.log('[WhatsApp Connect] ✅ WhatsApp Web initialized FAST:', response.data);
            // Status will update via socket when QR arrives
        } catch (err: any) {
            console.error('[WhatsApp Connect] Init error:', err);
            setIsInitializing(false);
            setShowQRButton(true);
            hasAutoInitialized.current = false; // Reset on failure
            if (err.code === 'ECONNREFUSED' || err.message?.includes('Network Error')) {
                setStatus('❌ Cannot connect to server. Is backend running?');
            } else {
                setStatus(`❌ Failed to initialize. Click button to retry.`);
            }
        }
    };

    const handleDisconnect = async () => {
        // Explicitly confirm with user as this is a destructive action
        if (!confirm('Are you sure you want to disconnect and link a new device?\n\n⚠️ This will clear all existing chats, messages, and contacts from the current account.')) return;

        console.log('[WhatsApp Connect] Link New Device clicked - will clear old data');
        setStatus('Disconnecting and clearing old data... (This will generate a new QR code)');
        setIsAuthenticated(false);
        setQrCode(null);
        setPhoneNumber(null);
        hasAutoInitialized.current = false; // Reset to allow immediate re-init

        try {
            // Clear data when linking new device
            const response = await axios.post('http://localhost:3000/api/whatsapp-web/disconnect', {
                clearData: true // Explicitly clear old data
            }, {
                withCredentials: true,
                timeout: 15000
            });
            console.log('[WhatsApp Connect] Disconnect response:', response.data);
            
            if (response.data.dataCleared) {
                setStatus('✅ Old data cleared! Generating new QR code...');
            }
            
            // Wait a bit then trigger new QR generation (backend will auto-init, but we'll also trigger it)
            setTimeout(async () => {
                setStatus('⚡ Generating new QR code...');
                try {
                    await axios.post('http://localhost:3000/api/whatsapp-web/init', {}, {
                        withCredentials: true,
                        timeout: 15000
                    });
                    console.log('[WhatsApp Connect] New QR generation triggered');
                } catch (initError: any) {
                    console.error('[WhatsApp Connect] Error generating new QR:', initError);
                    setStatus('❌ Error generating QR. Click "Force Generate QR Code" button.');
                }
            }, 3000);
        } catch (err: any) {
            console.error('[WhatsApp Connect] Disconnect error:', err);
            setStatus('⚠️ Disconnect error. Trying to generate new QR anyway...');
            
            // Try to generate QR anyway
            setTimeout(async () => {
                try {
                    await axios.post('http://localhost:3000/api/whatsapp-web/init', {}, {
                        withCredentials: true,
                        timeout: 15000
                    });
                } catch (initError: any) {
                    console.error('[WhatsApp Connect] Error generating QR:', initError);
                }
            }, 2000);
        }
    };

    return (
        <div className="whatsapp-connect-container">
            <div className="connect-card">
                <div className="header">
                    <svg className="whatsapp-logo" viewBox="0 0 175.216 175.552">
                        <path fill="#25D366" d="M87.184 25.227c-33.733 0-61.166 27.423-61.178 61.13a60.98 60.98 0 0 0 9.349 32.535l1.455 2.312-6.179 22.558 23.146-6.069 2.235 1.324c9.387 5.571 20.15 8.517 31.126 8.523h.023c33.707 0 61.14-27.426 61.153-61.135a60.75 60.75 0 0 0-17.895-43.251 60.75 60.75 0 0 0-43.235-17.927z" />
                        <path fill="#FFFFFF" d="M68.772 55.603c-1.378-3.061-2.828-3.123-4.137-3.176l-3.524-.043c-1.226 0-3.218.46-4.902 2.3s-6.435 6.287-6.435 15.332 6.588 17.785 7.506 19.013 12.718 20.381 31.405 27.75c15.529 6.124 18.689 4.906 22.061 4.6s10.877-4.447 12.408-8.74 1.532-7.971 1.073-8.74-1.685-1.226-3.525-2.146-10.877-5.367-12.562-5.981-2.91-.919-4.137.921-4.746 5.979-5.819 7.206-2.144 1.381-3.984.462-7.76-2.861-14.784-9.124c-5.465-4.873-9.154-10.891-10.228-12.73s-.114-2.835.808-3.751c.825-.824 1.838-2.147 2.759-3.22s1.224-1.84 1.836-3.065.307-2.301-.153-3.22-4.032-10.011-5.666-13.647" />
                    </svg>
                    <h1>Connect Your WhatsApp</h1>
                    <p className="subtitle">Scan the QR code to import all your chats and contacts</p>
                </div>

                {/* Show QR Code */}
                {qrCode && (
                    <div className="qr-section">
                        <img src={qrCode} alt="QR Code" className="qr-code" />
                        <div className="instructions">
                            <h3>How to connect:</h3>
                            <ol>
                                <li>Open <strong>WhatsApp</strong> on your phone</li>
                                <li>Tap <strong>Menu</strong> or <strong>Settings</strong></li>
                                <li>Tap <strong>Linked Devices</strong></li>
                                <li>Tap <strong>Link a Device</strong></li>
                                <li>Scan the QR Code</li>
                            </ol>
                        </div>
                    </div>
                )}

                <div className="status-indicator">
                    {status.includes('❌') && <span className="status-icon error">✕</span>}
                    {status.includes('✅') && <span className="status-icon success">✓</span>}
                    {status.includes('Scan') && <span className="status-icon info">ℹ️</span>}
                    {!status.includes('❌') && !status.includes('✅') && !status.includes('Scan') && (
                        <div className="spinner"></div>
                    )}
                    <p className="status">{status}</p>

                    {/* Fallback Manual Button if stuck */}
                    {!status.includes('Scan') && !status.includes('✅') && (
                        <button
                            onClick={handleGenerateQR}
                            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm font-medium"
                        >
                            Force Generate QR Code
                        </button>
                    )}
                </div>

                {/* Link New Device Button */}
                {isAuthenticated && (
                    <div style={{ marginTop: '20px' }}>
                        <button
                            onClick={handleDisconnect}
                            className="sync-button"
                            style={{ backgroundColor: '#dc2626' }} // Red for warning
                        >
                            Link New Device
                        </button>
                    </div>
                )}

                {/* Sync Progress */}
                {syncProgress && (
                    <div className="progress-section">
                        <h3>Syncing your chats...</h3>
                        <div className="progress-stats">
                            <div className="stat">
                                <span className="stat-label">Chats:</span>
                                <span className="stat-value">{syncProgress.current} / {syncProgress.total || 0}</span>
                            </div>
                            <div className="stat">
                                <span className="stat-label">Messages:</span>
                                <span className="stat-value">{syncProgress.messages || 0}</span>
                            </div>
                        </div>
                        {syncProgress.total > 0 && (
                            <div className="progress-bar">
                                <div
                                    className="progress-fill"
                                    style={{ width: `${(syncProgress.current / syncProgress.total) * 100}%` }}
                                />
                            </div>
                        )}
                    </div>
                )}

                {/* "Messages are fetching..." Modal */}
                {showFetchingModal && (
                    <div className="fetching-modal-overlay">
                        <div className="fetching-modal">
                            <div className="fetching-spinner"></div>
                            <h2>Messages are fetching...</h2>
                            <p>Please wait while we sync your chats and contacts</p>
                            <p style={{ fontSize: '14px', color: '#667781', marginTop: '8px', fontStyle: 'italic' }}>
                                ⏳ This may take up to 2 minutes. Please be patient...
                            </p>
                            {syncProgress && (syncProgress.total > 0 || syncProgress.totalContacts > 0) && (
                                <div className="fetching-progress">
                                    <div className="fetching-progress-bar">
                                        <div 
                                            className="fetching-progress-fill"
                                            style={{ 
                                                width: `${((syncProgress.current || syncProgress.contactsFetched || 0) / (syncProgress.total || syncProgress.totalContacts || 1)) * 100}%` 
                                            }}
                                        />
                                    </div>
                                    <p className="fetching-progress-text">
                                        {syncProgress.contactsFetched || syncProgress.current || 0} / {syncProgress.totalContacts || syncProgress.total || 0} contacts
                                        {syncProgress.messages > 0 && ` • ${syncProgress.messages} messages`}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
