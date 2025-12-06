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
            <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-white dark:bg-surface-dark shadow-soft">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Live Inbox</h1>
                    <p className="text-gray-500">Real-time conversation statistics</p>
                </div>
                <div className="relative">
                    <input
                        type="text"
                        placeholder="Search name or number..."
                        className="pl-10 pr-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-surface-darker text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none w-full md:w-64 transition-all"
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredStats.map((contact) => (
                        <div
                            key={contact.phoneNumber}
                            className="bg-white dark:bg-surface-dark rounded-2xl p-6 shadow-soft hover:shadow-lg transition-all duration-300 relative group border border-transparent hover:border-primary/10"
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                                        {contact.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-900 dark:text-white">{contact.name}</h3>
                                        <p className="text-xs text-gray-500 font-medium">{contact.phoneNumber}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleMarkAsRead(contact.phoneNumber)}
                                    className="bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold px-3 py-1.5 rounded-full transition-colors flex items-center gap-1.5"
                                    title="Mark as Read"
                                >
                                    {contact.unreadCount} NEW <CheckCircle className="w-3.5 h-3.5" />
                                </button>
                            </div>

                            <div className="flex items-center gap-4 mb-5">
                                <div className="flex-1 bg-gray-50 dark:bg-surface-darker p-2.5 rounded-xl text-center">
                                    <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-0.5">Total</p>
                                    <p className="text-lg font-bold text-gray-900 dark:text-white">{contact.totalMessages}</p>
                                </div>
                                <div className="flex-1 bg-gray-50 dark:bg-surface-darker p-2.5 rounded-xl text-center">
                                    <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-0.5">Unread</p>
                                    <p className="text-lg font-bold text-primary">
                                        {contact.unreadCount}
                                    </p>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
                                <div className="flex items-center text-xs text-gray-400 mb-2 font-medium">
                                    <Clock className="w-3.5 h-3.5 mr-1.5" />
                                    <span>{contact.lastMessageTime}</span>
                                </div>
                                <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 leading-relaxed">
                                    "{contact.lastMessageText}"
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Inbox;
