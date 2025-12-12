import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { QrCode, Send, Search, Phone, MessageSquare, RefreshCw } from 'lucide-react';
import { io, Socket } from 'socket.io-client';

interface Contact {
    number: string;
    name: string;
    lastMessageTime?: string;
    lastMessageText?: string;
    unreadCount?: number;
}

interface Message {
    id: string;
    sender: string;
    senderNumber?: string; // Original phone number
    recipient: string;
    text: string;
    time: string;
    timestamp: string;
    type: 'sent' | 'received';
    mediaUrl?: string;
    read: boolean;
}

// Helper to clean JSON names - CRITICAL FIX
// IMPORTANT: Only reject CLEARLY invalid data (JSON objects, pure phone numbers)
// Trust real names even if they contain some digits
const cleanContactName = (raw: string | undefined | null) => {
    if (!raw || !raw.trim()) return 'Unknown Contact';

    const trimmed = raw.trim();

    // ONLY reject JSON objects - these are clearly invalid
    if (trimmed.startsWith('{') || trimmed.includes('"server"') || trimmed.includes('"user"')) {
        return 'Unknown Contact';
    }
    
    // ONLY reject if it's PURELY a phone number (all digits, spaces, dashes, parentheses, +)
    // AND has no letters or other characters that would indicate it's a name
    const digitsOnly = trimmed.replace(/\D/g, '');
    const hasLetters = /[a-zA-Z]/.test(trimmed);
    
    // If it's purely numeric (no letters) AND looks like a phone number (10+ digits), reject it
    if (!hasLetters && digitsOnly.length >= 10 && /^\+?[\d\s\-\(\)]+$/.test(trimmed)) {
        return 'Unknown Contact';
    }
    
    // Reject serialized IDs (e.g. 123@c.us)
    if (trimmed.includes('@') && /^\d+@c\.us$/.test(trimmed)) {
        return 'Unknown Contact';
    }

    // Otherwise, TRUST IT - it's a real name (even if it has some digits in it)
    return trimmed;
};

// Memoized Contact Item Component to prevent unnecessary re-renders
const ContactItem = React.memo<{
    contact: Contact;
    isActive: boolean;
    isDark: boolean;
    formatTime: (timestamp?: string) => string;
    onClick: () => void;
}>(({ contact, isActive, isDark, formatTime, onClick }) => (
    <div
        onClick={onClick}
        className={`p-4 border-b cursor-pointer transition-colors ${isActive
            ? isDark
                ? 'bg-primary/20 border-primary/30'
                : 'bg-primary/10 border-primary/30'
            : isDark
                ? 'border-gray-700 hover:bg-gray-800'
                : 'border-gray-200 hover:bg-gray-50'
            }`}
    >
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${isDark ? 'bg-primary/20' : 'bg-primary/10'
                    }`}>
                    <Phone className={`w-6 h-6 ${isDark ? 'text-primary' : 'text-primary'}`} />
                </div>
                <div className="flex-1 min-w-0">
                    <div className={`font-semibold truncate ${isDark ? 'text-white' : 'text-gray-900'
                        }`}>
                        {/* CRITICAL: Show contact name from database - API already returns correct name */}
                        {(() => {
                            // Get name from contact.name (from database - API returns contact_name as name)
                            let nameToShow = contact.name;
                            
                            // Extract phone number for fallback
                            let phoneNumber = contact.number;
                            if (typeof phoneNumber === 'object') {
                                phoneNumber = (phoneNumber as any)?.user || (phoneNumber as any)?._serialized?.split('@')[0] || '';
                            }
                            const phoneStr = String(phoneNumber || '');
                            
                            // Clean phone number - remove JSON
                            let cleanPhone = phoneStr;
                            if (phoneStr.includes('{"server"') || phoneStr.includes('"server"') || phoneStr.includes('"user"')) {
                                const match = phoneStr.match(/"user":"(\d+)"/);
                                cleanPhone = match ? match[1] : phoneStr.split('@')[0];
                            }
                            
                            // CRITICAL: If we have a name from database, use it
                            // Only reject if it's clearly invalid (empty, "0", "WhatsApp", or JSON)
                            if (nameToShow && nameToShow !== null && nameToShow !== undefined) {
                                const trimmed = String(nameToShow).trim();
                                
                                // Reject clearly invalid names
                                if (trimmed === '' || trimmed === '0' || trimmed.toLowerCase() === 'whatsapp') {
                                    // Invalid name - use phone number
                                    return cleanPhone || 'Contact';
                                }
                                
                                // Reject JSON objects
                                if (trimmed.includes('{"server"') || trimmed.includes('"server"') || trimmed.includes('"user"') || trimmed.startsWith('{')) {
                                    // JSON - use phone number
                                    return cleanPhone || 'Contact';
                                }
                                
                                // If name is same as phone number, it means no name was saved
                                if (trimmed === cleanPhone || trimmed === phoneStr) {
                                    return cleanPhone || 'Contact';
                                }
                                
                                // VALID NAME - show it as-is (this is the contact name from database)
                                return trimmed;
                            }
                            
                            // No name from database - show phone number
                            if (cleanPhone && cleanPhone !== '0') {
                                return cleanPhone;
                            }
                            
                            // Last resort
                            return 'Contact';
                        })()}
                    </div>
                    {contact.lastMessageText && (() => {
                        let messageText = contact.lastMessageText || '';
                        // Filter out JSON strings from last message text
                        const isJSON = 
                            !messageText || 
                            messageText.trim().length === 0 ||
                            messageText.includes('{"server"') || 
                            messageText.includes('"server"') || 
                            messageText.includes('"user"') ||
                            messageText.includes('server":"') ||
                            messageText.includes('user":"') ||
                            messageText.trim().startsWith('{') ||
                            messageText.trim().startsWith('[') ||
                            /^\s*\{.*\}\s*$/.test(messageText.trim()) ||
                            /^\s*\{.*"server".*\}\s*$/.test(messageText.trim()) ||
                            /^\s*\{.*"user".*\}\s*$/.test(messageText.trim()) ||
                            (messageText.includes('server') && messageText.includes('user')) ||
                            (messageText.includes('server') && messageText.includes('lid')) ||
                            (messageText.includes('server') && messageText.includes('hd'));
                        
                        if (isJSON) {
                            return null; // Don't show JSON strings
                        }
                        // Also filter out serialized IDs
                        if (messageText.includes('@') && /^\d+@/.test(messageText.trim())) {
                            return null;
                        }
                        // Filter out pure phone numbers
                        if (/^[\d\s\-\(\)\+\.]+$/.test(messageText.trim()) && messageText.trim().length > 5) {
                            return null;
                        }
                        return (
                            <div className={`text-sm truncate ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                {messageText}
                            </div>
                        );
                    })()}
                    {/* Show phone number as subtitle ONLY if we have a REAL name (not a number) */}
                    {/* CRITICAL: Don't show subtitle if main name is a phone number */}
                    {(() => {
                        // Get the actual displayed name
                        const displayedName = (() => {
                            let nameToShow = contact.name;
                            if (nameToShow && nameToShow.trim() && !nameToShow.includes('{"server"') && !nameToShow.includes('"server"') && !nameToShow.includes('"user"') && !nameToShow.trim().startsWith('{')) {
                                return nameToShow.trim();
                            }
                            return null;
                        })();
                        
                        // If displayed name is a phone number, don't show subtitle
                        if (!displayedName || displayedName === contact.number || /^[\d\s\-\(\)\+\.]+$/.test(displayedName.replace(/\s/g, ''))) {
                            return null; // Don't show subtitle if main name is a number
                        }
                        
                        // We have a real name - show phone number as subtitle
                        if (!contact.number) return null;
                        
                        // Extract phone number from contact.number (handle JSON objects)
                        let phoneNumber = contact.number;
                        if (typeof phoneNumber === 'object' || (typeof phoneNumber === 'string' && phoneNumber.includes('{'))) {
                            try {
                                const parsed = typeof phoneNumber === 'string' ? JSON.parse(phoneNumber) : phoneNumber;
                                phoneNumber = parsed.user || parsed._serialized?.split('@')[0] || String(phoneNumber);
                            } catch (e) {
                                // If parsing fails, try to extract from string
                                const match = String(phoneNumber).match(/"user":"(\d+)"/);
                                if (match) phoneNumber = match[1];
                                else phoneNumber = String(phoneNumber).split('@')[0];
                            }
                        }
                        
                        // Only show if it's a valid phone number (not JSON)
                        const phoneStr = String(phoneNumber);
                        const isJSON = phoneStr.includes('{"server"') || phoneStr.includes('"server"') || phoneStr.includes('"user"') || phoneStr.trim().startsWith('{');
                        const isValidPhone = /^[\d\s\-\(\)\+]+$/.test(phoneStr) && phoneStr.replace(/\D/g, '').length >= 10;
                        
                        if (isJSON || !isValidPhone) {
                            return null; // Don't show JSON or invalid numbers
                        }
                        
                        return (
                            <div className={`text-xs truncate ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                {phoneStr}
                            </div>
                        );
                    })()}
                </div>
            </div>
            <div className="flex flex-col items-end gap-1 ml-2 self-center">
                {contact.lastMessageTime && (
                    <span className={`text-[10px] whitespace-nowrap ${isDark ? 'text-gray-500' : 'text-gray-400'
                        }`}>
                        {formatTime(contact.lastMessageTime)}
                    </span>
                )}
                {contact.unreadCount !== undefined && contact.unreadCount > 0 && (
                    <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold rounded-full bg-blue-500 text-white shadow-sm">
                        {contact.unreadCount}
                    </span>
                )}
            </div>
        </div>
    </div>
));

ContactItem.displayName = 'ContactItem';

const Chat: React.FC = () => {
    const { actualTheme } = useTheme();
    const navigate = useNavigate();
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [activeContact, setActiveContact] = useState<Contact | null>(null);
    const [inputMessage, setInputMessage] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [messagesLoading, setMessagesLoading] = useState(false);
    const [userId, setUserId] = useState<number | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const previousMessagesRef = useRef<string>('');
    const socketRef = useRef<Socket | null>(null);

    // New state for retry feedback
    const [retrying, setRetrying] = useState(false);

    // Fetch User ID
    useEffect(() => {
        axios.defaults.withCredentials = true; // IMPORTANT
        axios.get('http://localhost:3000/api/current_user')
            .then(res => {
                if (res.data && res.data.id) {
                    setUserId(res.data.id);
                } else {
                    console.warn('[Chat] No user logged in');
                }
            })
            .catch(err => console.error('[Chat] Failed to fetch user:', err));
    }, []);

    // Socket Connection
    useEffect(() => {
        if (!userId) return;

        const socket = io('http://localhost:3000', {
            withCredentials: true, // IMPORTANT
            transports: ['websocket', 'polling'],
            reconnection: true
        });
        socketRef.current = socket;

        socket.on('connect', () => {
            console.log('[Chat] Socket connected');
            socket.emit('join-room', userId);
        });

        // Real-time message listener (Replaces Polling)
        socket.on('new-message', (data: any) => {
            console.log('[Chat] New message received:', data);

            // Extract phone number from data
            const senderNumber = data.senderNumber || (data.from || '').split('@')[0];
            const recipientNumber = data.recipient || (data.to || '').split('@')[0];
            const isFromMe = data.fromMe || false;

            // 1. Update Messages if chat is open
            if (activeContact) {
                // Extract active contact number properly
                let activeContactNumber = activeContact.number;
                if (typeof activeContactNumber === 'object') {
                    activeContactNumber = (activeContactNumber as any)?.user || (activeContactNumber as any)?._serialized?.split('@')[0];
                } else if (typeof activeContactNumber === 'string' && activeContactNumber.includes('@')) {
                    activeContactNumber = activeContactNumber.split('@')[0];
                }

                const isForActiveChat =
                    (!isFromMe && senderNumber === activeContactNumber) ||
                    (isFromMe && recipientNumber === activeContactNumber);

                if (isForActiveChat) {
                    const msg: Message = {
                        id: data.id || `msg-${Date.now()}`,
                        sender: isFromMe ? 'Me' : (data.sender || senderNumber),
                        senderNumber: senderNumber,
                        recipient: isFromMe ? recipientNumber : 'Me',
                        text: data.text || data.body || '',
                        time: data.time || new Date(data.timestamp * 1000).toLocaleTimeString(),
                        timestamp: new Date(data.timestamp * 1000).toISOString(),
                        type: isFromMe ? 'sent' : 'received',
                        read: isFromMe || false // Mark as read if from me, unread if from others
                    };

                    setMessages(prev => {
                        // Avoid duplicates
                        if (prev.some(m => m.id === msg.id)) return prev;
                        return [...prev, msg];
                    });

                    // CRITICAL: If chat is open, mark as read on server immediately
                    if (!isFromMe) {
                        axios.post('http://localhost:3000/messages/read', {
                            phoneNumber: activeContactNumber
                        }).catch(err => console.error('[Chat] Failed to mark new message read:', err));
                    }
                }
            }

            // 2. Update Contacts List (Unread count, last message, time)
            setContacts(prev => prev.map(contact => {
                let contactNumber = contact.number;
                if (typeof contactNumber === 'object') {
                    contactNumber = (contactNumber as any)?.user || (contactNumber as any)?._serialized?.split('@')[0];
                } else if (typeof contactNumber === 'string' && contactNumber.includes('@')) {
                    contactNumber = contactNumber.split('@')[0];
                }

                // Check if this message is for this contact
                const isForThisContact = 
                    (!isFromMe && senderNumber === contactNumber) ||
                    (isFromMe && recipientNumber === contactNumber);

                if (isForThisContact) {
                    // Filter JSON from message text
                    let messageText = data.text || data.body || '';
                    const isJSON = 
                        !messageText || 
                        messageText.includes('{"server"') || 
                        messageText.includes('"user"') ||
                        messageText.trim().startsWith('{');

                    return {
                        ...contact,
                        lastMessageText: isJSON ? contact.lastMessageText : messageText, // Only update if not JSON
                        lastMessageTime: new Date(data.timestamp * 1000).toISOString(),
                        unreadCount: isFromMe ? (contact.unreadCount || 0) : ((contact.unreadCount || 0) + 1) // Increment if not from me
                    };
                }
                return contact;
            }));

            // Sort contacts by last message time
            setContacts(prev => {
                const sorted = [...prev].sort((a, b) => {
                    const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
                    const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
                    return timeB - timeA;
                });
                return sorted;
            });
        });

        socket.on('sync-complete', (data: any) => {
            console.log('[Chat] Sync occurred, refreshing data...', data);
            // Show success notification
            if (data && (data.chats > 0 || data.contacts > 0)) {
                console.log(`[Chat] Sync complete: ${data.chats} chats, ${data.messages} messages, ${data.contacts} contacts`);
                if (data.message) {
                    console.log(`[Chat] ${data.message}`);
                }
            }

            // CRITICAL: Clear UI state first, then refresh with new data
            setContacts([]);
            setMessages([]);
            setActiveContact(null);

            // Wait a bit longer to ensure data is saved to database, then refresh
            setTimeout(() => {
                console.log('[Chat] Refreshing contacts after sync...');
                refreshContacts(0); // Start fresh retry
            }, 1000); // 1 second delay to ensure data is saved
        });

        // Listen for disconnected event - Clear data when new device is linked
        socket.on('disconnected', (data: any) => {
            console.log('[Chat] WhatsApp disconnected', data);
            // Clear all data when disconnecting (especially when linking new device)
            setContacts([]);
            setMessages([]);
            setActiveContact(null);
            setLoading(false);

            if (data?.dataCleared) {
                console.log('[Chat] ✅ Old data was cleared - ready for new device data');
                // Show message to user
                console.log('[Chat] Waiting for new device to sync...');
            }
        });

        return () => {
            // Cleanup listeners
            if (socketRef.current) {
                socketRef.current.off('connect');
                socketRef.current.off('new-message');
                socketRef.current.off('sync-complete');
                socketRef.current.off('disconnected');
                socketRef.current.disconnect();
            }
        };
    }, [userId, activeContact]);

    // FAST: Modified refreshContacts with optimized retry logic
    const refreshContacts = async (retryCount = 0) => {
        setLoading(true);
        try {
            console.log(`[Chat] ⚡ FAST Fetching contacts (Attempt ${retryCount + 1})...`);

            // FAST: Fetch both in parallel for speed
            const [contactsResponse, messagesResponse] = await Promise.all([
                axios.get('http://localhost:3000/api/whatsapp-business/conversations', {
                    withCredentials: true,
                    timeout: 60000 // No time limit - user wants complete data
                }),
                axios.get('http://localhost:3000/api/whatsapp-business/messages', {
                    withCredentials: true,
                    timeout: 60000 // No time limit - user wants complete data
                })
            ]);

            const contactsData = contactsResponse.data;
            const allMessages: Message[] = messagesResponse.data;

            if (contactsData.length > 0) {
                // FAST: We have data, process it immediately
                processContacts(contactsData, allMessages);
                setRetrying(false);
                console.log(`[Chat] ✅ FAST Loaded ${contactsData.length} contacts`);
            } else {
                // Empty data - retry faster
                if (retryCount < 8) { // More retries but faster
                    setRetrying(true);
                    console.log('[Chat] No contacts found. Retrying FAST in 1.5s...');
                    setTimeout(() => refreshContacts(retryCount + 1), 1500); // Faster retry
                } else {
                    setContacts([]); // Give up
                    setLoading(false);
                    setRetrying(false);
                }
            }
        } catch (error: any) {
            console.error('Error refreshing contacts:', error);
            // If it's a 401, user might not be logged in - that's okay for now
            if (error.response?.status === 401) {
                console.log('[Chat] Not authenticated, using default user');
            }
            setLoading(false);
            setRetrying(false);
        }
    };

    const processContacts = (contactsData: any[], allMessages: any[]) => {
        const messagesByContact = new Map<string, Message[]>();
        allMessages.forEach(msg => {
            const contactNum = msg.type === 'sent' ? msg.recipient : msg.sender;
            if (!messagesByContact.has(contactNum)) {
                messagesByContact.set(contactNum, []);
            }
            messagesByContact.get(contactNum)!.push(msg);
        });

        const contactsWithUnread = contactsData
            .filter((contact: any) => {
                // Filter out invalid contacts where both number and name are "0"
                if (contact.number === '0' && contact.name === '0') {
                    return false;
                }
                // Filter out contacts with no valid number
                if (!contact.number || contact.number.trim() === '' || contact.number === '0') {
                    return false;
                }
                return true;
            })
            .map((contact: any) => {
            const contactMessages = messagesByContact.get(contact.number) || [];
            const unreadCount = contactMessages.filter(msg =>
                msg.sender === contact.number && !msg.read
            ).length;

            const lastMessage = contactMessages.length > 0
                ? contactMessages.reduce((latest, current) =>
                    new Date(current.timestamp).getTime() > new Date(latest.timestamp).getTime() ? current : latest
                )
                : null;

            // CRITICAL: Use name from database (contact_name) - API already returns the correct name
            // The API returns contact.name which is the contact_name from database
            // We should ALWAYS use it if it exists and is valid
            let displayName = contact.name;
            
            // CRITICAL: Only reject if name is clearly invalid
            // If name is null, undefined, empty, or "0" - it means name is NOT saved
            if (!displayName || displayName === null || displayName === undefined || 
                displayName === '' || displayName === '0' || displayName.trim() === '' || displayName.trim() === '0') {
                // No name saved - use phone number
                displayName = contact.number;
            } else {
                // We have a name - check if it's invalid
                const trimmedName = displayName.trim();
                
                // If name is same as number, it means API returned number as name (no name saved)
                if (trimmedName === contact.number) {
                    displayName = contact.number; // Use number
                } 
                // Filter out "WhatsApp" as name - it's not a real contact name
                else if (trimmedName.toLowerCase() === 'whatsapp') {
                    displayName = contact.number; // Use number instead
                }
                // Otherwise, USE THE NAME AS-IS (it's a valid contact name from database)
                else {
                    displayName = trimmedName; // Use the actual contact name
                }
            }
            
            // CRITICAL: Clean contact.number - remove JSON objects
            let cleanNumber = contact.number;
            if (typeof cleanNumber === 'object' || (typeof cleanNumber === 'string' && cleanNumber.includes('{'))) {
                try {
                    const parsed = typeof cleanNumber === 'string' ? JSON.parse(cleanNumber) : cleanNumber;
                    cleanNumber = parsed.user || parsed._serialized?.split('@')[0] || String(cleanNumber);
                } catch (e) {
                    // If parsing fails, try to extract from string
                    const match = String(cleanNumber).match(/"user":"(\d+)"/);
                    if (match) cleanNumber = match[1];
                    else cleanNumber = String(cleanNumber).split('@')[0];
                }
            }
            // Filter out JSON strings from number
            const numberStr = String(cleanNumber);
            if (numberStr.includes('{"server"') || numberStr.includes('"server"') || numberStr.includes('"user"') || numberStr.trim().startsWith('{')) {
                // If number is JSON, try to extract phone number
                const match = numberStr.match(/"user":"(\d+)"/);
                cleanNumber = match ? match[1] : '';
            }

            const finalContact = {
                number: cleanNumber, // Clean number without JSON
                name: displayName, // Always set name properly (from database contact_name)
                unreadCount,
                lastMessageText: lastMessage?.text || '',
                lastMessageTime: lastMessage?.time || contact.lastMessageTime,
                isGroup: contact.isGroup || false
            };
            
            return finalContact;
        });

        contactsWithUnread.sort((a: Contact, b: Contact) => {
            const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
            const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
            return timeB - timeA;
        });

        // DEBUG: Log first few contacts to verify names are being preserved
        if (contactsWithUnread.length > 0) {
            console.log(`[Chat] Processed ${contactsWithUnread.length} contacts. First 3:`, 
                contactsWithUnread.slice(0, 3).map(c => `"${c.name}" (${c.number})`).join(', '));
        }

        setContacts(contactsWithUnread);
        setLoading(false);
    };

    // Initial Load - FIXED: Don't trigger sync here, let WhatsAppConnect handle it
    useEffect(() => {
        const initialize = async () => {
            // Just check status and load contacts - DON'T trigger sync
            // Sync should only happen from WhatsAppConnect page to avoid interruption
            try {
                const statusResponse = await axios.get('http://localhost:3000/api/whatsapp-web/status', {
                    withCredentials: true
                });
                console.log('[Chat] WhatsApp status:', statusResponse.data);

                // Only log status, don't trigger sync here
                if (!statusResponse.data.ready) {
                    console.log('[Chat] ⚠️ WhatsApp not ready - user should connect first');
                } else {
                    console.log('[Chat] ✅ WhatsApp ready - loading contacts...');
                }
            } catch (statusErr) {
                console.log('[Chat] Could not check WhatsApp status, continuing anyway:', statusErr);
            }

            // Always try to refresh contacts (will retry if no data)
            refreshContacts(0);
        };

        initialize();
    }, []);

    // Fetch messages when active contact changes
    useEffect(() => {
        if (!activeContact) {
            setMessages([]);
            return;
        }

        // Extract phone number properly (handle JSON objects)
        let phoneNumber = activeContact.number;
        if (typeof phoneNumber === 'object' || (typeof phoneNumber === 'string' && phoneNumber.includes('{'))) {
            try {
                const parsed = typeof phoneNumber === 'string' ? JSON.parse(phoneNumber) : phoneNumber;
                phoneNumber = parsed.user || parsed._serialized?.split('@')[0] || phoneNumber;
            } catch (e) {
                // If parsing fails, try to extract from string
                const match = String(phoneNumber).match(/"user":"(\d+)"/);
                if (match) phoneNumber = match[1];
                else phoneNumber = String(phoneNumber).split('@')[0];
            }
        }

        // Lazy-Repair Name: If name is just number, try to fetch real name
        const cleanName = cleanContactName(activeContact.name);
        if (cleanName === phoneNumber || activeContact.name === phoneNumber) {
            console.log('Attempting to resolve contact name for', phoneNumber);
            axios.get(`http://localhost:3000/api/whatsapp-business/contacts/${encodeURIComponent(phoneNumber)}`, {
                timeout: 30000 // Increased timeout for contact resolution
            })
                .then(res => {
                    if (res.data.name && res.data.name !== phoneNumber) {
                        console.log('Resolved name:', res.data.name);
                        // Update list
                        setContacts(prev => prev.map(c => {
                            if (!c.number) return c;
                            const cNum = typeof c.number === 'object' ? (c.number?.user || c.number?._serialized?.split('@')[0]) : c.number;
                            return cNum === phoneNumber ? { ...c, name: res.data.name } : c;
                        }));
                        // Update active
                        setActiveContact(prev => prev ? { ...prev, name: res.data.name } : null);
                    }
                })
                .catch(err => console.warn('Name resolution failed', err));
        }

        fetchMessages(phoneNumber);
    }, [activeContact?.number]);

    const fetchMessages = async (contactNumber: string) => {
        setMessagesLoading(true);
        try {
            // Extract phone number properly (handle JSON objects)
            let phoneNumber = contactNumber;
            if (typeof phoneNumber === 'object' || (typeof phoneNumber === 'string' && phoneNumber.includes('{'))) {
                try {
                    const parsed = typeof phoneNumber === 'string' ? JSON.parse(phoneNumber) : phoneNumber;
                    phoneNumber = parsed.user || parsed._serialized?.split('@')[0] || phoneNumber;
                } catch (e) {
                    const match = String(phoneNumber).match(/"user":"(\d+)"/);
                    if (match) phoneNumber = match[1];
                    else phoneNumber = String(phoneNumber).split('@')[0];
                }
            }

            const response = await axios.get(
                `http://localhost:3000/api/whatsapp-business/messages/${encodeURIComponent(phoneNumber)}`,
                { timeout: 60000 } // No time limit - user wants complete data
            );
            setMessages(response.data);

            // Mark read and update unread count
            const unreadMessages = response.data.filter((msg: Message) => !msg.read && msg.sender === phoneNumber);
            if (unreadMessages.length > 0) {
                await axios.post('http://localhost:3000/messages/read', {
                    phoneNumber: phoneNumber
                });
                // Update local state immediately (optimistic update)
                setContacts(prev => prev.map(contact => {
                    let contactNumber = contact.number;
                    if (typeof contactNumber === 'object') {
                        contactNumber = (contactNumber as any)?.user || (contactNumber as any)?._serialized?.split('@')[0];
                    } else if (typeof contactNumber === 'string' && contactNumber.includes('@')) {
                        contactNumber = contactNumber.split('@')[0];
                    }
                    if (contactNumber === phoneNumber) {
                        return { ...contact, unreadCount: 0 };
                    }
                    return contact;
                }));
                // Also update active contact
                if (activeContact) {
                    setActiveContact(prev => prev ? { ...prev, unreadCount: 0 } : null);
                }
                refreshContacts(); // Refresh to sync with server
            }

            // AUTO-SYNC HISTORY if too few messages (e.g. just started or incomplete)
            if (response.data.length < 10) {
                console.log('History sparse, triggering auto-sync...');
                // Fire and forget sync, then refresh - use extracted phoneNumber
                axios.post('http://localhost:3000/messages/sync', { 
                    phoneNumber: phoneNumber 
                }, { 
                    timeout: 300000 // 5 minutes timeout for sync - no time limit
                })
                    .then(() => {
                        // Refresh messages again after 2 seconds to pick up new history
                        setTimeout(() => {
                            axios.get(`http://localhost:3000/api/whatsapp-business/messages/${encodeURIComponent(phoneNumber)}`, {
                                timeout: 60000
                            })
                                .then(res => setMessages(res.data))
                                .catch(err => console.log('Refetch failed', err));
                        }, 2000);
                    })
                    .catch(err => console.log('Auto-sync trigger failed (might be offline)', err));
            }
        } catch (error) {
            console.error('Error fetching messages:', error);
        } finally {
            setMessagesLoading(false);
        }
    };

    // Auto-scroll
    useEffect(() => {
        if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    }, [messages.length]);

    const handleSendMessage = useCallback(async () => {
        if (!inputMessage.trim() || !activeContact || sending) return;

        const messageText = inputMessage.trim();
        setInputMessage('');

        try {
            setSending(true);
            try {
                await axios.post('http://localhost:3000/api/whatsapp-web/send', {
                    phoneNumber: activeContact.number,
                    message: messageText
                });
            } catch (webError: any) {
                console.warn('WhatsApp Web send failed, trying Business API:', webError);
                await axios.post('http://localhost:3000/send', {
                    message: messageText,
                    phoneNumber: activeContact.number
                });
            }

            // Optimistic update
            const optimisticMessage: Message = {
                id: `temp-${Date.now()}`,
                sender: 'Me',
                recipient: activeContact.number,
                text: messageText,
                time: new Date().toLocaleTimeString(),
                timestamp: new Date().toISOString(),
                type: 'sent',
                read: true
            };
            setMessages(prev => [...prev, optimisticMessage]);

            // Helper to refresh messages slightly later to get real ID
            setTimeout(() => {
                fetchMessages(activeContact.number);
            }, 1000);

        } catch (error: any) {
            console.error('Error sending message:', error);
            alert(`Failed to send message: ${error.response?.data?.error || error.message}.`);
            setInputMessage(messageText);
        } finally {
            setSending(false);
        }
    }, [inputMessage, activeContact, sending]);

    // Memoize filtered contacts
    const filteredContacts = useMemo(() => {
        if (!searchQuery.trim()) return contacts;
        const query = searchQuery.toLowerCase();
        return contacts.filter(contact =>
            contact.name.toLowerCase().includes(query) ||
            contact.number.includes(query)
        );
    }, [contacts, searchQuery]);

    const formatTime = useCallback((timestamp?: string) => {
        if (!timestamp || timestamp === 'Invalid Date') return '';
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) return ''; // Handle invalid dates

        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (days === 0) {
            return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        } else if (days === 1) {
            return 'Yesterday';
        } else if (days < 7) {
            return date.toLocaleDateString('en-US', { weekday: 'short' });
        } else {
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
    }, []);

    const isDark = actualTheme === 'dark';

    return (
        <div className={`h-full w-full flex ${isDark ? 'dark' : ''}`}>
            {/* Sidebar - Contacts List */}
            <div className={`w-80 border-r ${isDark ? 'bg-surface-darker border-gray-700' : 'bg-white border-gray-200'} flex flex-col`}>
                {/* Header with Scanner Button */}
                <div className={`p-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            WhatsApp Chats
                        </h2>
                        <div className="flex gap-2">
                            <button
                                onClick={() => refreshContacts(0)}
                                className={`p-2 rounded-lg transition-colors ${isDark
                                    ? 'bg-gray-700 hover:bg-gray-600 text-white'
                                    : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                                    }`}
                                title="Refresh Contacts"
                            >
                                <RefreshCw className={`w-4 h-4 ${retrying ? 'animate-spin' : ''}`} />
                            </button>
                            <button
                                onClick={() => navigate('/whatsapp-connect')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${isDark
                                    ? 'bg-primary hover:bg-primary/80 text-white'
                                    : 'bg-primary hover:bg-primary/90 text-white'
                                    }`}
                                title="Scan WhatsApp QR Code"
                            >
                                <QrCode className="w-4 h-4" />
                                <span className="text-sm font-medium">Scan</span>
                            </button>
                        </div>
                    </div>
                    {retrying && (
                        <div className="text-xs text-center text-blue-500 mb-2 animate-pulse">
                            Syncing chats... (Please wait)
                        </div>
                    )}
                    {/* Search Bar */}
                    <div className="relative">
                        <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                        <input
                            type="text"
                            placeholder="Search contacts..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className={`w-full pl-10 pr-4 py-2 rounded-lg border ${isDark
                                ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-400'
                                : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-500'
                                } focus:outline-none focus:ring-2 focus:ring-primary`}
                        />
                    </div>
                </div>

                {/* Contacts List */}
                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className={`p-4 text-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            Loading contacts...
                        </div>
                    ) : filteredContacts.length === 0 ? (
                        <div className={`p-4 text-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            {searchQuery ? 'No contacts found' : 'No contacts yet. Scan WhatsApp to get started!'}
                        </div>
                    ) : (
                        filteredContacts.map((contact) => (
                            <ContactItem
                                key={contact.number || `contact-${Math.random()}`}
                                contact={contact}
                                isActive={activeContact?.number === contact.number}
                                isDark={isDark}
                                formatTime={formatTime}
                                onClick={() => setActiveContact(contact)}
                            />
                        ))
                    )}
                </div>
            </div>

            {/* Main Chat Area */}
            <div className={`flex-1 flex flex-col ${isDark ? 'bg-surface-darker' : 'bg-gray-50'}`}>
                {activeContact ? (
                    <>
                        {/* Chat Header */}
                        <div className={`p-4 border-b ${isDark ? 'bg-surface-dark border-gray-700' : 'bg-white border-gray-200'}`}>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3 flex-1">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isDark ? 'bg-primary/20' : 'bg-primary/10'}`}>
                                        <Phone className={`w-5 h-5 ${isDark ? 'text-primary' : 'text-primary'}`} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h3 className={`font-semibold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                {(() => {
                                                    // Extract phone number first
                                                    let phoneNumber = activeContact.number;
                                                    if (typeof phoneNumber === 'object') {
                                                        phoneNumber = (phoneNumber as any)?.user || (phoneNumber as any)?._serialized?.split('@')[0] || '';
                                                    }
                                                    const phoneStr = String(phoneNumber || '');
                                                    
                                                    // If name is "0", treat it as invalid and use phone number instead
                                                    if (activeContact.name && activeContact.name.trim() && activeContact.name !== '0' && activeContact.name !== phoneStr) {
                                                        const cleaned = cleanContactName(activeContact.name);
                                                        // If cleaned name is valid (not "Unknown Contact"), show it
                                                        if (cleaned !== 'Unknown Contact' && cleaned !== 'WhatsApp Contact' && cleaned.trim()) {
                                                            return cleaned;
                                                        }
                                                    }
                                                    
                                                    // Always show phone number instead of "Unknown Contact"
                                                    if (phoneStr && phoneStr !== '0' && phoneStr.trim()) {
                                                        // Clean the number - remove JSON
                                                        let cleanNum = phoneStr;
                                                        if (phoneStr.includes('{"server"') || phoneStr.includes('"server"') || phoneStr.includes('"user"')) {
                                                            const match = phoneStr.match(/"user":"(\d+)"/);
                                                            cleanNum = match ? match[1] : phoneStr.split('@')[0];
                                                        }
                                                        return cleanNum;
                                                    }
                                                    
                                                    // Last resort - show generic placeholder
                                                    return 'Contact';
                                                })()}
                                            </h3>
                                            {activeContact.unreadCount !== undefined && activeContact.unreadCount > 0 && (
                                                <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold rounded-full bg-blue-500 text-white shadow-sm">
                                                    {activeContact.unreadCount}
                                                </span>
                                            )}
                                        </div>
                                        {activeContact.name && activeContact.name.trim() && activeContact.name !== activeContact.number && activeContact.number && (
                                            <p className={`text-sm truncate ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                                {typeof activeContact.number === 'object' 
                                                    ? ((activeContact.number as any)?.user || (activeContact.number as any)?._serialized?.split('@')[0] || '')
                                                    : String(activeContact.number)}
                                            </p>
                                        )}
                                        {activeContact.lastMessageTime && (
                                            <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                                {formatTime(activeContact.lastMessageTime)}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {messagesLoading && messages.length === 0 ? (
                                <div className={`text-center py-8 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                    Loading messages...
                                </div>
                            ) : messages.length === 0 ? (
                                <div className={`text-center py-8 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                    No messages yet. Start the conversation!
                                </div>
                            ) : (
                                messages.map((message) => (
                                    <div
                                        key={message.id}
                                        className={`flex flex-col ${message.type === 'sent' ? 'items-end' : 'items-start'}`}
                                    >
                                        {/* Show sender name for received messages */}
                                        {/* Show sender name for received messages */}
                                        {message.type === 'received' && message.sender && message.sender !== 'Me' && (
                                            <div className={`text-xs mb-1 px-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                                {(() => {
                                                    const cleanSender = cleanContactName(message.sender);
                                                    // Try to find name in contacts list first
                                                    const knownContact = contacts.find(c => c.number === cleanSender || c.number === message.sender);
                                                    return knownContact ? (knownContact.name || cleanSender) : cleanSender;
                                                })()}
                                            </div>
                                        )}
                                        <div
                                            className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${message.type === 'sent'
                                                ? isDark
                                                    ? 'bg-primary text-white'
                                                    : 'bg-primary text-white'
                                                : isDark
                                                    ? 'bg-gray-800 text-white'
                                                    : 'bg-white text-gray-900 border border-gray-200'
                                                }`}
                                        >
                                            {message.mediaUrl && (
                                                <div className="mb-2">
                                                    {message.mediaUrl.match(/\.(jpg|jpeg|png|gif)$/i) ? (
                                                        <img
                                                            src={`http://localhost:3000${message.mediaUrl}`}
                                                            alt="Media"
                                                            className="max-w-full rounded-lg"
                                                        />
                                                    ) : message.mediaUrl.match(/\.(mp4|webm|ogg)$/i) ? (
                                                        <video
                                                            src={`http://localhost:3000${message.mediaUrl}`}
                                                            controls
                                                            className="max-w-full rounded-lg"
                                                        />
                                                    ) : (
                                                        <a
                                                            href={`http://localhost:3000${message.mediaUrl}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-blue-400 hover:underline"
                                                        >
                                                            Download File
                                                        </a>
                                                    )}
                                                </div>
                                            )}
                                            <div className="text-sm">{message.text}</div>
                                            <div className={`text-xs mt-1 ${message.type === 'sent'
                                                ? 'text-white/70'
                                                : isDark
                                                    ? 'text-gray-400'
                                                    : 'text-gray-500'
                                                }`}>
                                                {message.time}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className={`p-4 border-t ${isDark ? 'bg-surface-dark border-gray-700' : 'bg-white border-gray-200'}`}>
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={inputMessage}
                                    onChange={(e) => setInputMessage(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                                    placeholder="Type a message..."
                                    className={`flex-1 px-4 py-2 rounded-lg border ${isDark
                                        ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-400'
                                        : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-500'
                                        } focus:outline-none focus:ring-2 focus:ring-primary`}
                                    disabled={sending}
                                />
                                <button
                                    onClick={handleSendMessage}
                                    disabled={sending || !inputMessage.trim()}
                                    className={`p-2 rounded-lg transition-colors ${sending || !inputMessage.trim()
                                        ? isDark
                                            ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                        : 'bg-primary text-white hover:bg-primary/90'
                                        }`}
                                >
                                    <Send className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="text-center">
                            <MessageSquare className={`w-16 h-16 mx-auto mb-4 ${isDark ? 'text-gray-600' : 'text-gray-400'
                                }`} />
                            <h3 className={`text-xl font-semibold mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'
                                }`}>
                                Select a contact to start chatting
                            </h3>
                            <p className={`${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                Or scan WhatsApp to import your contacts
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Chat;
