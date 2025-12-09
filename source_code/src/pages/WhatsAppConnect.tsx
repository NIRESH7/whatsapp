import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './WhatsAppConnect.css';

export default function WhatsAppConnect() {
    const [qrCode, setQrCode] = useState<string | null>(null);
    const [status, setStatus] = useState<string>('Click the button below to generate QR code');
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [syncProgress, setSyncProgress] = useState<any>(null);
    const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
    const [showQRButton, setShowQRButton] = useState(true);
    const [isInitializing, setIsInitializing] = useState(false);
    const socketRef = useRef<Socket | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        // Get user ID (default to 1 for now)
        const userId = 1;

        // Initialize socket connection
        const socket = io('http://localhost:3000', {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000
        });

        socketRef.current = socket;

        // Handle socket connection
        socket.on('connect', () => {
            console.log('[WhatsApp Connect] Socket connected:', socket.id);
            // Join user room after connection
            socket.emit('join-room', userId);
            console.log('[WhatsApp Connect] Joined room for user', userId);
        });

        // If already connected, join room immediately
        if (socket.connected) {
            socket.emit('join-room', userId);
            console.log('[WhatsApp Connect] Socket already connected, joining room:', userId);
        }

        socket.on('connect_error', (error) => {
            console.error('[WhatsApp Connect] Socket connection error:', error);
            setStatus('❌ Failed to connect to server. Make sure the backend is running on port 3000.');
            setIsInitializing(false);
        });

        socket.on('disconnect', (reason) => {
            console.log('[WhatsApp Connect] Socket disconnected:', reason);
            if (reason === 'io server disconnect') {
                // Server disconnected, try to reconnect
                socket.connect();
            }
        });

        // Listen for QR code
        socket.on('qr-code', (qrImage: string) => {
            console.log('[WhatsApp Connect] QR Code received');
            setQrCode(qrImage);
            setStatus('Scan QR code with your phone');
            setShowQRButton(false);
            setIsInitializing(false);
        });

        // Listen for authentication
        socket.on('authenticated', () => {
            console.log('[WhatsApp Connect] Authenticated!');
            setStatus('Authenticated! Connecting...');
            setIsAuthenticated(true);
        });

        // Listen for ready
        socket.on('ready', async (data: any) => {
            console.log('[WhatsApp Connect] WhatsApp Web ready:', data);
            setStatus(`✅ Connected as +${data.phoneNumber}! Starting sync...`);
            setPhoneNumber(data.phoneNumber);
            setQrCode(null);
            
            // Auto-start sync after connection
            try {
                console.log('[WhatsApp Connect] Auto-starting sync...');
                await axios.post('http://localhost:3000/api/whatsapp-web/sync');
                console.log('[WhatsApp Connect] Sync started');
            } catch (err: any) {
                console.error('[WhatsApp Connect] Sync error:', err);
                setStatus('❌ Failed to start sync. Please try manually.');
            }
        });

        // Listen for sync progress
        socket.on('sync-progress', (progress: any) => {
            console.log('[WhatsApp Connect] Sync progress:', progress);
            setSyncProgress(progress);
            if (progress.total > 0) {
                setStatus(`Syncing... ${progress.current}/${progress.total} chats`);
            } else {
                setStatus('Preparing to sync...');
            }
        });

        // Listen for sync complete
        socket.on('sync-complete', (data: any) => {
            console.log('[WhatsApp Connect] Sync complete:', data);
            setStatus(`✅ Sync complete! ${data.chats} chats, ${data.messages} messages, ${data.contacts} contacts`);
            setSyncProgress(null);

            // Redirect to chat page after 2 seconds
            setTimeout(() => {
                navigate('/chat');
            }, 2000);
        });

        // Listen for sync error
        socket.on('sync-error', (error: any) => {
            console.error('[WhatsApp Connect] Sync error:', error);
            setStatus(`❌ Sync failed: ${error.message}`);
            setSyncProgress(null);
        });

        // Listen for disconnection
        socket.on('disconnected', () => {
            console.log('[WhatsApp Connect] Disconnected');
            setStatus('Disconnected. Please click the button to reconnect.');
            setIsAuthenticated(false);
            setQrCode(null);
            setShowQRButton(true);
        });

        // Listen for auth failure
        socket.on('auth-failure', (data: any) => {
            console.error('[WhatsApp Connect] Auth failure:', data);
            setStatus(`❌ Authentication failed: ${data.message}`);
            setQrCode(null);
            setShowQRButton(true);
            setIsInitializing(false);
        });

        return () => {
            socket.off('connect');
            socket.off('connect_error');
            socket.off('disconnect');
            socket.off('qr-code');
            socket.off('authenticated');
            socket.off('ready');
            socket.off('sync-progress');
            socket.off('sync-complete');
            socket.off('sync-error');
            socket.off('disconnected');
            socket.off('auth-failure');
        };
    }, [navigate]);

    const handleGenerateQR = async () => {
        if (isInitializing) return;

        try {
            setIsInitializing(true);
            setShowQRButton(false);
            setStatus('Connecting to server...');
            
            // Wait for socket connection
            if (!socketRef.current?.connected) {
                await new Promise((resolve) => {
                    if (socketRef.current?.connected) {
                        resolve(true);
                    } else {
                        socketRef.current?.once('connect', resolve);
                        setTimeout(resolve, 5000); // Timeout after 5 seconds
                    }
                });
            }

            // Initialize WhatsApp Web client
            const response = await axios.post('http://localhost:3000/api/whatsapp-web/init');
            console.log('[WhatsApp Connect] WhatsApp Web initialized:', response.data);
            setStatus('Generating QR code...');
        } catch (err: any) {
            console.error('[WhatsApp Connect] Init error:', err);
            setIsInitializing(false);
            setShowQRButton(true);
            if (err.code === 'ECONNREFUSED' || err.message?.includes('Network Error')) {
                setStatus('❌ Cannot connect to server. Make sure the backend is running on port 3000.');
            } else {
                setStatus(`❌ Failed to initialize: ${err.response?.data?.error || err.message}. Please try again.`);
            }
        }
    };

    const handleSync = () => {
        setStatus('Starting sync...');
        axios.post('http://localhost:3000/api/whatsapp-web/sync')
            .then(() => {
                console.log('[WhatsApp Connect] Sync started');
            })
            .catch(err => {
                console.error('[WhatsApp Connect] Sync error:', err);
                setStatus('❌ Failed to start sync');
            });
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

                {/* Show QR Button First */}
                {showQRButton && !qrCode && !isAuthenticated && (
                    <div className="qr-button-section">
                        <button 
                            onClick={handleGenerateQR} 
                            className="generate-qr-button"
                            disabled={isInitializing}
                        >
                            {isInitializing ? (
                                <>
                                    <div className="spinner"></div>
                                    <span>Generating QR Code...</span>
                                </>
                            ) : (
                                <>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                        <path d="M9 9h6v6H9z"></path>
                                    </svg>
                                    <span>Generate QR Code</span>
                                </>
                            )}
                        </button>
                    </div>
                )}

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
                                <li>Point your phone at this screen to scan the QR code</li>
                            </ol>
                        </div>
                    </div>
                )}

                <div className="status-section">
                    <div className="status-indicator">
                        {status.includes('❌') && <span className="status-icon error">✕</span>}
                        {status.includes('✅') && <span className="status-icon success">✓</span>}
                        {!status.includes('❌') && !status.includes('✅') && !showQRButton && (
                            <div className="spinner"></div>
                        )}
                        <p className="status">{status}</p>
                    </div>

                    {/* Manual sync button (if needed) */}
                    {isAuthenticated && phoneNumber && !syncProgress && !qrCode && (
                        <button onClick={handleSync} className="sync-button">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Import Chat History
                        </button>
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
        </div>
    );
}
