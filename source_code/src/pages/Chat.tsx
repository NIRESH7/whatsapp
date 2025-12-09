import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { QrCode, Send, Search, Phone, MessageSquare } from 'lucide-react';

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
    recipient: string;
    text: string;
    time: string;
    timestamp: string;
    type: 'sent' | 'received';
    mediaUrl?: string;
    read: boolean;
}

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
        className={`p-4 border-b cursor-pointer transition-colors ${
            isActive
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
                <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                    isDark ? 'bg-primary/20' : 'bg-primary/10'
                }`}>
                    <Phone className={`w-6 h-6 ${isDark ? 'text-primary' : 'text-primary'}`} />
                </div>
                <div className="flex-1 min-w-0">
                    <div className={`font-semibold truncate ${
                        isDark ? 'text-white' : 'text-gray-900'
                    }`}>
                        {contact.name && contact.name !== contact.number ? contact.name : contact.number}
                    </div>
                    {contact.lastMessageText && (
                        <div className={`text-sm truncate ${
                            isDark ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                            {contact.lastMessageText}
                        </div>
                    )}
                </div>
            </div>
            <div className="flex flex-col items-end gap-1 ml-2">
                {contact.lastMessageTime && (
                    <span className={`text-xs ${
                        isDark ? 'text-gray-500' : 'text-gray-400'
                    }`}>
                        {formatTime(contact.lastMessageTime)}
                    </span>
                )}
                {contact.unreadCount && contact.unreadCount > 0 && (
                    <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-red-600 text-white">
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
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const previousContactsRef = useRef<string>('');
    const previousMessagesRef = useRef<string>('');

    // Fetch contacts from WhatsApp Business API (optimized)
    useEffect(() => {
        let isMounted = true;
        const fetchContacts = async () => {
            try {
                if (!isMounted) return;
                
                const response = await axios.get('http://localhost:3000/api/whatsapp-business/conversations');
                const contactsData = response.data;

                // Only fetch all messages once, then calculate unread counts efficiently
                const allMessagesResponse = await axios.get('http://localhost:3000/api/whatsapp-business/messages');
                const allMessages: Message[] = allMessagesResponse.data;

                // Create a map for faster lookups
                const messagesByContact = new Map<string, Message[]>();
                allMessages.forEach(msg => {
                    const contactNum = msg.type === 'sent' ? msg.recipient : msg.sender;
                    if (!messagesByContact.has(contactNum)) {
                        messagesByContact.set(contactNum, []);
                    }
                    messagesByContact.get(contactNum)!.push(msg);
                });

                const contactsWithUnread = contactsData.map((contact: Contact) => {
                    const contactMessages = messagesByContact.get(contact.number) || [];
                    const unreadCount = contactMessages.filter(msg =>
                        msg.sender === contact.number && !msg.read
                    ).length;

                    // Find last message efficiently
                    const lastMessage = contactMessages.length > 0
                        ? contactMessages.reduce((latest, current) => 
                            new Date(current.timestamp).getTime() > new Date(latest.timestamp).getTime() ? current : latest
                          )
                        : null;

                    return {
                        ...contact,
                        unreadCount,
                        lastMessageText: lastMessage?.text || '',
                        lastMessageTime: lastMessage?.time || contact.lastMessageTime
                    };
                });

                // Sort by last message time (most recent first)
                contactsWithUnread.sort((a: Contact, b: Contact) => {
                    const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
                    const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
                    return timeB - timeA;
                });

                // Only update state if data actually changed
                const contactsString = JSON.stringify(contactsWithUnread);
                if (contactsString !== previousContactsRef.current && isMounted) {
                    previousContactsRef.current = contactsString;
                    setContacts(contactsWithUnread);
                }
            } catch (error) {
                console.error('Error fetching contacts:', error);
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        fetchContacts();
        // Reduced polling frequency to 15 seconds
        const interval = setInterval(fetchContacts, 15000);
        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, []);

    // Fetch messages for active contact (optimized)
    useEffect(() => {
        if (!activeContact) {
            setMessages([]);
            previousMessagesRef.current = '';
            return;
        }

        let isMounted = true;
        previousMessagesRef.current = ''; // Reset when contact changes

        const fetchMessages = async () => {
            if (!isMounted) return;
            
            try {
                setMessagesLoading(true);
                const response = await axios.get(
                    `http://localhost:3000/api/whatsapp-business/messages/${activeContact.number}`
                );
                
                // Only update if messages actually changed
                const messagesString = JSON.stringify(response.data);
                if (messagesString !== previousMessagesRef.current && isMounted) {
                    previousMessagesRef.current = messagesString;
                    setMessages(response.data);
                }

                // Mark messages as read (only once, not on every poll)
                if (response.data.some((msg: Message) => !msg.read && msg.sender === activeContact.number)) {
                    await axios.post('http://localhost:3000/messages/read', {
                        phoneNumber: activeContact.number
                    });
                }
            } catch (error) {
                console.error('Error fetching messages:', error);
            } finally {
                if (isMounted) {
                    setMessagesLoading(false);
                }
            }
        };

        fetchMessages();
        // Reduced polling frequency to 10 seconds
        const interval = setInterval(fetchMessages, 10000);
        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, [activeContact?.number]);

    // Auto-scroll to bottom when new messages arrive (debounced)
    useEffect(() => {
        if (scrollTimeoutRef.current) {
            clearTimeout(scrollTimeoutRef.current);
        }
        
        scrollTimeoutRef.current = setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
        
        return () => {
            if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current);
            }
        };
    }, [messages.length]); // Only trigger on message count change, not content

    const handleSendMessage = useCallback(async () => {
        if (!inputMessage.trim() || !activeContact || sending) return;

        const messageText = inputMessage.trim();
        setInputMessage('');
        
        try {
            setSending(true);
            // Try WhatsApp Web first, fallback to Business API
            try {
                await axios.post('http://localhost:3000/api/whatsapp-web/send', {
                    phoneNumber: activeContact.number,
                    message: messageText
                });
            } catch (webError: any) {
                // Fallback to Business API if WhatsApp Web fails
                console.warn('WhatsApp Web send failed, trying Business API:', webError);
                await axios.post('http://localhost:3000/send', {
                    message: messageText,
                    phoneNumber: activeContact.number
                });
            }

            // Optimistically add message to UI
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

            // Refresh messages after a delay (only if needed)
            setTimeout(async () => {
                try {
                    const response = await axios.get(
                        `http://localhost:3000/api/whatsapp-business/messages/${activeContact.number}`
                    );
                    setMessages(response.data);
                } catch (err) {
                    console.error('Error refreshing messages:', err);
                }
            }, 2000);
        } catch (error: any) {
            console.error('Error sending message:', error);
            alert(`Failed to send message: ${error.response?.data?.error || error.message}. Please try again.`);
            setInputMessage(messageText); // Restore message on error
        } finally {
            setSending(false);
        }
    }, [inputMessage, activeContact, sending]);

    // Memoize filtered contacts to prevent unnecessary recalculations
    const filteredContacts = useMemo(() => {
        if (!searchQuery.trim()) return contacts;
        const query = searchQuery.toLowerCase();
        return contacts.filter(contact =>
            contact.name.toLowerCase().includes(query) ||
            contact.number.includes(query)
        );
    }, [contacts, searchQuery]);

    // Memoize formatTime to prevent recreation on every render
    const formatTime = useCallback((timestamp?: string) => {
        if (!timestamp) return '';
        const date = new Date(timestamp);
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
                        <button
                            onClick={() => navigate('/whatsapp-connect')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                                isDark
                                    ? 'bg-primary hover:bg-primary/80 text-white'
                                    : 'bg-primary hover:bg-primary/90 text-white'
                            }`}
                            title="Scan WhatsApp QR Code"
                        >
                            <QrCode className="w-4 h-4" />
                            <span className="text-sm font-medium">Scan</span>
                        </button>
                    </div>
                    {/* Search Bar */}
                    <div className="relative">
                        <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                        <input
                            type="text"
                            placeholder="Search contacts..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className={`w-full pl-10 pr-4 py-2 rounded-lg border ${
                                isDark
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
                                key={contact.number}
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
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                    isDark ? 'bg-primary/20' : 'bg-primary/10'
                                }`}>
                                    <Phone className={`w-5 h-5 ${isDark ? 'text-primary' : 'text-primary'}`} />
                                </div>
                                <div>
                                    <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                        {activeContact.name && activeContact.name !== activeContact.number 
                                            ? activeContact.name 
                                            : activeContact.number}
                                    </h3>
                                    {activeContact.name && activeContact.name !== activeContact.number && (
                                        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                            {activeContact.number}
                                        </p>
                                    )}
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
                                        className={`flex ${message.type === 'sent' ? 'justify-end' : 'justify-start'}`}
                                    >
                                        <div
                                            className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                                                message.type === 'sent'
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
                                            <div className={`text-xs mt-1 ${
                                                message.type === 'sent'
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
                                    className={`flex-1 px-4 py-2 rounded-lg border ${
                                        isDark
                                            ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-400'
                                            : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-500'
                                    } focus:outline-none focus:ring-2 focus:ring-primary`}
                                    disabled={sending}
                                />
                                <button
                                    onClick={handleSendMessage}
                                    disabled={sending || !inputMessage.trim()}
                                    className={`p-2 rounded-lg transition-colors ${
                                        sending || !inputMessage.trim()
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
                            <MessageSquare className={`w-16 h-16 mx-auto mb-4 ${
                                isDark ? 'text-gray-600' : 'text-gray-400'
                            }`} />
                            <h3 className={`text-xl font-semibold mb-2 ${
                                isDark ? 'text-gray-300' : 'text-gray-700'
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
