import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { MessageSquare, Clock, CheckCircle } from 'lucide-react';

interface Message {
    id: string;
    sender: string;
    recipient?: string;
    text: string;
    time: string;
    timestamp: string;
    type: string;
    read?: boolean;
}

interface ContactStats {
    phoneNumber: string;
    name: string;
    totalMessages: number;
    unreadCount: number;
    lastMessageTime: string;
    lastMessageText: string;
}

const Inbox: React.FC = () => {
    const [stats, setStats] = useState<ContactStats[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchMessages = async () => {
        try {
            const response = await axios.get('http://localhost:3000/messages');
            const messages: Message[] = response.data;
            processMessages(messages);
        } catch (error) {
            console.error('Error fetching messages:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMessages();
        const interval = setInterval(fetchMessages, 3000); // Poll every 3 seconds
        return () => clearInterval(interval);
    }, []);

    const processMessages = (messages: Message[]) => {
        const contactMap = new Map<string, ContactStats>();

        messages.forEach(msg => {
            // Identify the contact (sender if received, recipient if sent)
            // For Inbox stats, we primarily care about people who messaged US
            const isReceived = msg.type !== 'sent';
            const contactNumber = isReceived ? msg.sender : msg.recipient;

            if (!contactNumber || contactNumber === 'Me') return;

            if (!contactMap.has(contactNumber)) {
                contactMap.set(contactNumber, {
                    phoneNumber: contactNumber,
                    name: contactNumber, // Could be enriched if we had a contact list
                    totalMessages: 0,
                    unreadCount: 0,
                    lastMessageTime: '',
                    lastMessageText: ''
                });
            }

            const contact = contactMap.get(contactNumber)!;
            contact.totalMessages++;

            // Update last message (assuming messages are roughly chronological or we sort)
            // A simple way is to just take the latest one we process if we assume array order
            // But better to compare timestamps if available. 
            // For now, let's assume the array is appended to, so the last one is latest.
            contact.lastMessageTime = msg.time;
            contact.lastMessageText = msg.text;

            if (isReceived && !msg.read) {
                contact.unreadCount++;
            }
        });

        const sortedStats = Array.from(contactMap.values()).sort((a, b) => {
            // Sort by unread count desc, then total messages desc
            if (b.unreadCount !== a.unreadCount) return b.unreadCount - a.unreadCount;
            return b.totalMessages - a.totalMessages;
        });

        setStats(sortedStats);
    };

    const handleMarkAsRead = async (phoneNumber: string) => {
        try {
            await axios.post('http://localhost:3000/messages/read', { phoneNumber });
            // Optimistically update UI or just wait for next poll
            fetchMessages();
        } catch (error) {
            console.error('Error marking as read:', error);
        }
    };

    const filteredStats = stats.filter(contact =>
        (contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            contact.phoneNumber.includes(searchQuery)) &&
        contact.unreadCount > 0
    );

    return (
        <div className="p-8 h-full bg-surface-light dark:bg-surface-darker">
            <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-gray-200 dark:border-gray-800">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Live Inbox</h1>
                    <p className="text-gray-500">Real-time conversation statistics</p>
                </div>
                <div className="relative">
                    <input
                        type="text"
                        placeholder="Search name or number..."
                        className="pl-10 pr-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-surface-dark text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-500/20 focus:border-gray-500 outline-none w-full md:w-72 transition-all shadow-sm"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <svg className="w-5 h-5 text-gray-400 absolute left-3 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                    </svg>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
            ) : filteredStats.length === 0 ? (
                <div className="text-center py-12 bg-white dark:bg-surface-dark rounded-2xl shadow-soft">
                    <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">All caught up!</h3>
                    <p className="text-gray-500 mt-2">{searchQuery ? 'No unread messages match your search.' : 'No new unread messages.'}</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {filteredStats.map((contact) => (
                        <div
                            key={contact.phoneNumber}
                            className="bg-white dark:bg-surface-dark rounded-[24px] p-3 md:p-6 shadow-sm hover:shadow-2xl transition-all duration-300 relative group border border-gray-100 dark:border-gray-800 hover:-translate-y-1"
                        >
                            <div className="flex items-start justify-between mb-3 md:mb-6">
                                <div className="flex flex-col items-center gap-2 w-full md:w-auto md:flex-1 md:flex-row md:items-center md:gap-4 md:text-left min-w-0">
                                    <div className="relative flex-shrink-0">
                                        <div className="w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm md:text-xl shadow-lg shadow-blue-500/20">
                                            {contact.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="absolute -bottom-1 -right-1 bg-green-500 w-3 h-3 md:w-4 md:h-4 rounded-full border-2 border-white dark:border-surface-dark"></div>
                                    </div>
                                    <div className="min-w-0 flex-1 text-center md:text-left w-full">
                                        <h3 className="text-sm md:text-lg font-bold text-gray-900 dark:text-white leading-tight truncate px-1">{contact.name}</h3>
                                        <p className="text-[10px] md:text-sm text-gray-500 font-medium tracking-wide break-all px-1">{contact.phoneNumber}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleMarkAsRead(contact.phoneNumber)}
                                    className="absolute top-2 right-2 md:static md:translate-x-0 bg-black hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-200 text-white dark:text-black text-[10px] font-bold p-1 md:px-4 md:py-2 rounded-full transition-all flex items-center justify-center gap-2 shadow-lg shadow-gray-200/50 dark:shadow-none z-10 flex-shrink-0"
                                    title="Mark as Read"
                                >
                                    <span className="hidden md:inline">{contact.unreadCount} NEW</span>
                                    <CheckCircle className="w-3 h-3 md:w-3.5 md:h-3.5" />
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-2 md:gap-3 mb-3 md:mb-6">
                                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl md:rounded-2xl p-2 md:p-3 flex flex-col items-center justify-center border border-gray-100 dark:border-gray-700/50">
                                    <span className="text-[8px] md:text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1 text-center">Total Messages</span>
                                    <span className="text-lg md:text-2xl font-black text-gray-900 dark:text-white">{contact.totalMessages}</span>
                                </div>
                                <div className="bg-red-50 dark:bg-red-900/10 rounded-xl md:rounded-2xl p-2 md:p-3 flex flex-col items-center justify-center border border-red-100 dark:border-red-900/20">
                                    <span className="text-[8px] md:text-[10px] uppercase font-bold text-red-500 tracking-wider mb-1 text-center">Unread</span>
                                    <span className="text-lg md:text-2xl font-black text-red-600 dark:text-red-400">{contact.unreadCount}</span>
                                </div>
                            </div>

                            <div className="relative bg-gray-50 dark:bg-gray-800/30 rounded-2xl p-4 border border-gray-100 dark:border-gray-800">
                                <div className="absolute top-4 left-4 text-gray-300 dark:text-gray-700">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M14.017 21L14.017 18C14.017 16.8954 13.1216 16 12.017 16H9C9.00001 15 9.00001 13 11 13C13 13 13.017 10 11 10C8.00001 10 7.00001 12 6.00001 16C5 19 6 21 8 21H12.017C13.1216 21 14.017 20.1046 14.017 19V21ZM21.017 21L21.017 18C21.017 16.8954 20.1216 16 19.017 16H16C16 15 16 13 18 13C20 13 20.017 10 18 10C15 10 14 12 13 16C12 19 13 21 15 21H19.017C20.1216 21 21.017 20.1046 21.017 19V21Z" />
                                    </svg>
                                </div>
                                <div className="pl-6">
                                    <div className="flex items-center justify-end text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-wider">
                                        <Clock className="w-3 h-3 mr-1" />
                                        {contact.lastMessageTime}
                                    </div>
                                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 italic leading-relaxed line-clamp-2">
                                        "{contact.lastMessageText}"
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Inbox;
