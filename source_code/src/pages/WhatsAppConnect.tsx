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
            setStatus(`✅ Connected! Starting fast sync...`);
            setPhoneNumber(data.phoneNumber);
            setQrCode(null);
            setIsAuthenticated(true);

            // FAST: Auto-start sync immediately
            try {
                console.log('[WhatsApp Connect] Starting fast sync...');
                setStatus(`🔄 Fetching your chats and contacts...`);
                // Don't await - let it run in background, show progress via socket
                axios.post('http://localhost:3000/api/whatsapp-web/sync', {}, {
                    withCredentials: true
                }).catch(err => {
                    console.error('[WhatsApp Connect] Sync error:', err);
                    setStatus('❌ Sync failed. Redirecting anyway...');
                    setTimeout(() => navigate('/chat'), 2000);
                });
            } catch (err: any) {
                console.error('[WhatsApp Connect] Sync error:', err);
            }
        });

        // Listen for sync progress - FAST UPDATES
        socket.on('sync-progress', (progress: any) => {
            setSyncProgress(progress);
            if (progress.total > 0) {
                const percent = Math.round((progress.current / progress.total) * 100);
                setStatus(`🔄 Syncing... ${progress.current}/${progress.total} chats (${percent}%)`);
            } else {
                setStatus('🔄 Preparing to sync...');
            }
        });

        // Listen for sync complete - FAST REDIRECT
        socket.on('sync-complete', (data: any) => {
            console.log('[WhatsApp Connect] ✅ Sync complete - FAST!', data);
            const chatsCount = data.chats || 0;
            const messagesCount = data.messages || 0;
            const contactsCount = data.contacts || 0;
            setStatus(`✅ Successfully fetched ${chatsCount} chats, ${messagesCount} messages, and ${contactsCount} contacts!`);
            setSyncProgress(null);

            // FAST: Redirect quickly after success message
            setTimeout(() => {
                navigate('/chat');
            }, 1500); // Reduced from 2000ms for faster redirect
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
        socket.on('disconnected', () => {
            console.log('[WhatsApp Connect] Disconnected');
            setStatus('Disconnected. Preparing new session...');
            setIsAuthenticated(false);
            setQrCode(null);
            setShowQRButton(true);
            setPhoneNumber(null);
            hasAutoInitialized.current = false; // Allow auto-init again

            // Auto-trigger init again explicitly (optional, but good for flow)
            // We'll let the dependency array handle it
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
        if (!confirm('Are you sure you want to disconnect and link a new device?')) return;

        setStatus('Disconnecting... (This calls for a new QR code)');
        hasAutoInitialized.current = false; // Reset to allow immediate re-init

        try {
            await axios.post('http://localhost:3000/api/whatsapp-web/disconnect');
            // State reset happens in 'disconnected' socket event, which triggers auto-init
        } catch (err: any) {
            console.error('Disconnect error:', err);
            setStatus('❌ Failed to disconnect');
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
            </div>
        </div>

    );
}
