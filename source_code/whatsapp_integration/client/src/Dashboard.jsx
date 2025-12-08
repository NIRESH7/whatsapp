import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { read, utils } from 'xlsx';
import './Dashboard.css';

import { MdDarkMode, MdLightMode } from 'react-icons/md';
import { FaPaperclip, FaMagic, FaDownload } from 'react-icons/fa';
import darkModeIcon from './assets/dark-mode.png';

const Dashboard = ({ isDarkMode, toggleTheme }) => {
    const [messages, setMessages] = useState([]);
    const [inputMessage, setInputMessage] = useState('');
    const [activeContact, setActiveContact] = useState(null); // Phone number of selected contact
    const [sending, setSending] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadedContacts, setUploadedContacts] = useState([]);
    const [newChatNumber, setNewChatNumber] = useState('');
    const [isNewChatOpen, setIsNewChatOpen] = useState(false);
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedContacts, setSelectedContacts] = useState(new Set());
    const [showBulkModal, setShowBulkModal] = useState(false);
    const [bulkMessageText, setBulkMessageText] = useState('');
    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const [customTemplates, setCustomTemplates] = useState([]);
    const [showCreateTemplate, setShowCreateTemplate] = useState(false);
    const [newTemplateName, setNewTemplateName] = useState('');
    const [newTemplateLabel, setNewTemplateLabel] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const fileInputRef = useRef(null);

    const TEMPLATES = [
        { name: 'hello_world', label: 'Hello World' },
        { name: 'shipping_update', label: 'Shipping Update' },
        { name: 'reservation_update', label: 'Reservation Update' },
        { name: 'issue_resolution', label: 'Issue Resolution' },
        { name: 'appointment_reminder', label: 'Appointment Reminder' },
        ...customTemplates
    ];

    // Load custom templates from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('customTemplates');
        if (saved) {
            try {
                setCustomTemplates(JSON.parse(saved));
            } catch (e) {
                console.error('Error loading custom templates:', e);
            }
        }

        // Request saved contacts from parent (Main App)
        window.parent.postMessage({ type: 'REQUEST_CONTACTS' }, '*');

        const handleMessage = (event) => {
            if (event.data.type === 'LOAD_CONTACTS') {
                console.log('Loaded contacts from parent:', event.data.contacts.length);
                setUploadedContacts(event.data.contacts);
            }
        };
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    // Sync uploaded contacts to parent (Main App) for persistence
    useEffect(() => {
        if (uploadedContacts.length > 0) {
            window.parent.postMessage({ type: 'SAVE_CONTACTS', contacts: uploadedContacts }, '*');
        }
    }, [uploadedContacts]);

    // Poll for new messages every 2 seconds
    useEffect(() => {
        const fetchMessages = async () => {
            try {
                const response = await axios.get('http://localhost:3000/messages');
                const fetchedMessages = response.data;
                setMessages(fetchedMessages);
            } catch (error) {
                console.error('Error fetching messages:', error);
            }
        };

        fetchMessages(); // Initial fetch
        const interval = setInterval(fetchMessages, 2000);
        return () => clearInterval(interval);
    }, []);

    // Derive unique contacts from messages and uploaded list
    const contacts = useMemo(() => {
        const uniqueNumbers = new Set();
        const contactList = [];

        // 1. Add from Uploaded Contacts
        uploadedContacts.forEach(c => {
            if (!uniqueNumbers.has(c.number)) {
                uniqueNumbers.add(c.number);
                contactList.push({ ...c, type: 'uploaded' });
            }
        });

        // 2. Add from Messages (Senders and Recipients)
        messages.forEach(msg => {
            // If I received it, the sender is the contact
            if (msg.type !== 'sent' && msg.sender && msg.sender !== 'Me') {
                if (!uniqueNumbers.has(msg.sender)) {
                    uniqueNumbers.add(msg.sender);
                    contactList.push({ name: msg.sender, number: msg.sender, type: 'history' });
                }
            }
            // If I sent it, the recipient is the contact
            if (msg.type === 'sent' && msg.recipient) {
                if (!uniqueNumbers.has(msg.recipient)) {
                    uniqueNumbers.add(msg.recipient);
                    contactList.push({ name: msg.recipient, number: msg.recipient, type: 'history' });
                }
            }
        });

        // 3. Enrich with Metadata (Unread Count, Last Message Time)
        const enrichedContacts = contactList.map(contact => {
            const contactMessages = messages.filter(msg =>
                (msg.sender === contact.number) || (msg.recipient === contact.number)
            );

            // Sort messages by timestamp to find the last one
            contactMessages.sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));
            const lastMsg = contactMessages[contactMessages.length - 1];

            // Count unread: Messages FROM contact that are NOT read (server status)
            const unreadCount = contactMessages.filter(msg =>
                msg.sender === contact.number && !msg.read
            ).length;

            return {
                ...contact,
                lastMessageTime: lastMsg ? lastMsg.time : '',
                lastMessageTimestamp: lastMsg ? (lastMsg.timestamp || 0) : 0,
                lastMessageText: lastMsg ? (lastMsg.text || (lastMsg.mediaUrl ? '[Media]' : '')) : '',
                unreadCount
            };
        });

        // 4. Sort Contacts by Last Message Timestamp (Descending)
        enrichedContacts.sort((a, b) => new Date(b.lastMessageTimestamp) - new Date(a.lastMessageTimestamp));

        return enrichedContacts;
    }, [messages, uploadedContacts]);

    // Filter contacts based on search query
    const filteredContacts = useMemo(() => {
        if (!searchQuery.trim()) {
            return contacts;
        }

        const query = searchQuery.toLowerCase();
        return contacts.filter(contact =>
            contact.name.toLowerCase().includes(query) ||
            contact.number.includes(query)
        );
    }, [contacts, searchQuery]);

    // Mark messages as read when activeContact changes
    useEffect(() => {
        if (activeContact) {
            // Notify Server to mark as read (Sync with Live Inbox)
            axios.post('http://localhost:3000/messages/read', { phoneNumber: activeContact })
                .then(res => console.log('Marked as read on server:', res.data))
                .catch(err => console.error('Error marking as read on server:', err));
        }
    }, [activeContact]);

    // Filter messages for the active contact
    const activeMessages = useMemo(() => {
        if (!activeContact) return [];
        return messages.filter(msg =>
            (msg.sender === activeContact) || (msg.recipient === activeContact)
        );
    }, [messages, activeContact]);

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target.result;
            const wb = read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const data = utils.sheet_to_json(ws);

            const formattedContacts = data.map(row => {
                const keys = Object.keys(row);
                const nameKey = keys.find(k => k.toLowerCase().includes('name')) || keys[0];
                const mobileKey = keys.find(k => k.toLowerCase().includes('mobile') || k.toLowerCase().includes('phone') || k.toLowerCase().includes('number')) || keys[1];

                return {
                    name: row[nameKey],
                    number: String(row[mobileKey])
                };
            }).filter(c => c.number);

            setUploadedContacts(formattedContacts);
        };
        reader.readAsBinaryString(file);
    };

    const handleBulkSend = async () => {
        if (!bulkMessageText.trim()) return;

        setSending(true);
        try {
            const promises = Array.from(selectedContacts).map(number =>
                axios.post('http://localhost:3000/send', {
                    message: bulkMessageText,
                    phoneNumber: number,
                })
            );

            await Promise.all(promises);
            alert(`Successfully sent to ${selectedContacts.size} contacts!`);
            setBulkMessageText('');
            setShowBulkModal(false);
            setSelectedContacts(new Set());
            setIsSelectionMode(false);
        } catch (error) {
            console.error('Error sending bulk messages:', error);
            alert('Failed to send some messages. Check console.');
        } finally {
            setSending(false);
        }
    };

    const handleSendMessage = async () => {
        if (!inputMessage || !activeContact) {
            alert('Please select a contact and enter a message.');
            return;
        }

        setSending(true);
        try {
            const response = await axios.post('http://localhost:3000/send', {
                message: inputMessage,
                phoneNumber: activeContact,
            });
            console.log('Message sent:', response.data);
            setInputMessage('');
        } catch (error) {
            console.error('Error sending message:', error);
            // Check for specific WhatsApp API errors regarding 24hr window
            const errorDetails = error.response?.data?.details?.error?.message || '';
            const errorCode = error.response?.data?.details?.error?.code;

            if (errorCode === 131047 || errorDetails.includes('template') || errorDetails.includes('24 hours')) {
                alert('⚠️ WhatsApp Policy: You cannot send a free-form message to a new contact.\n\nPlease click the "Template" button to start the conversation!');
            } else {
                alert('Failed to send message. ' + (errorDetails || 'Check console for details.'));
            }
        } finally {
            setSending(false);
        }
    };

    const handleSendTemplate = async (templateName) => {
        if (!activeContact) {
            alert('Please select a contact.');
            return;
        }

        setSending(true);
        try {
            const response = await axios.post('http://localhost:3000/send-template', {
                templateName: templateName || 'hello_world',
                phoneNumber: activeContact,
                languageCode: 'en_US'
            });
            console.log('Template sent:', response.data);
            alert('Template sent successfully!');
            setShowTemplateModal(false);
        } catch (error) {
            console.error('Error sending template:', error);
            alert('Failed to send template. Check console for details.');
        } finally {
            setSending(false);
        }
    };

    const handleCreateTemplate = () => {
        if (!newTemplateName.trim() || !newTemplateLabel.trim()) {
            alert('Please fill in both Template Name and Display Label');
            return;
        }

        const newTemplate = {
            name: newTemplateName.toLowerCase().replace(/\s+/g, '_'),
            label: newTemplateLabel
        };

        const updated = [...customTemplates, newTemplate];
        setCustomTemplates(updated);
        localStorage.setItem('customTemplates', JSON.stringify(updated));

        setNewTemplateName('');
        setNewTemplateLabel('');
        setShowCreateTemplate(false);
        alert(`Template "${newTemplateLabel}" created successfully!`);
    };

    const handleDeleteTemplate = (templateName) => {
        if (confirm('Are you sure you want to permanently delete this template?')) {
            const updated = customTemplates.filter(t => t.name !== templateName);
            setCustomTemplates(updated);
            localStorage.setItem('customTemplates', JSON.stringify(updated));
            alert('Template deleted successfully!');
        }
    };

    const handleFileSelect = async (e) => {
        const file = e.target.files[0];
        if (!file || !activeContact) return;

        setIsUploading(true);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('phoneNumber', activeContact);
        // Optional: Add caption logic here if needed

        try {
            const response = await axios.post('http://localhost:3000/send-media', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            console.log('Media sent:', response.data);
        } catch (error) {
            console.error('Error sending media:', error);
            alert('Failed to send media.');
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = ''; // Reset input
        }
    };

    const startNewChat = () => {
        if (!newChatNumber) return;
        setActiveContact(newChatNumber);
        setIsNewChatOpen(false);
        setNewChatNumber('');
    };

    // Helper to get display name
    const getDisplayName = (number) => {
        const contact = uploadedContacts.find(c => c.number === number);
        return contact ? contact.name : number;
    };

    return (
        <div className={`dashboard-container ${isDarkMode ? 'dark-mode' : ''}`}>
            {/* Sidebar: Contact List */}
            <div className={`sidebar ${activeContact ? 'hidden-mobile' : ''}`}>
                <div className="sidebar-header">
                    <h2>Messages</h2>
                    <div className="header-actions">

                        {/* Theme Toggle Removed - Controlled by Main App */}
                        {isSelectionMode && (
                            <button
                                className="icon-btn"
                                title="Select All"
                                onClick={() => {
                                    if (selectedContacts.size === filteredContacts.length) {
                                        setSelectedContacts(new Set());
                                    } else {
                                        const allIds = new Set(filteredContacts.map(c => c.number));
                                        setSelectedContacts(allIds);
                                    }
                                }}
                            >
                                <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>ALL</span>
                            </button>
                        )}
                        <button
                            className={`icon-btn ${isSelectionMode ? 'active' : ''}`}
                            title={isSelectionMode ? "Cancel Selection" : "Select Contacts"}
                            onClick={() => {
                                setIsSelectionMode(!isSelectionMode);
                                setSelectedContacts(new Set()); // Clear selection on toggle
                            }}
                        >
                            <span>{isSelectionMode ? '✕' : '✓'}</span>
                        </button>
                        <button
                            className="icon-btn"
                            title="New Chat"
                            onClick={() => setIsNewChatOpen(true)}
                        >
                            <span>✎</span>
                        </button>
                    </div>
                </div>

                {isNewChatOpen && (
                    <div className="new-chat-modal">
                        <input
                            type="text"
                            placeholder="Enter mobile number"
                            value={newChatNumber}
                            onChange={(e) => setNewChatNumber(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && startNewChat()}
                            autoFocus
                        />
                        <button onClick={startNewChat}>send</button>
                        <button onClick={() => setIsNewChatOpen(false)} className="close-btn">×</button>
                    </div>
                )}

                <div className="search-bar-container">
                    <input type="file" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} style={{ display: 'none' }} id="contact-upload-input" />
                    <input
                        type="text"
                        placeholder="Search contacts..."
                        className="search-input"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <button
                        className="upload-btn-inside-search"
                        onClick={() => document.getElementById('contact-upload-input').click()}
                        title="Import Contacts"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                            <line x1="12" y1="18" x2="12" y2="12"></line>
                            <line x1="9" y1="15" x2="15" y2="15"></line>
                        </svg>
                    </button>
                </div>

                {selectedContacts.size > 0 && (
                    <div className="bulk-action-bar">
                        <button onClick={() => setShowBulkModal(true)}>
                            Send to {selectedContacts.size} contacts
                        </button>
                    </div>
                )}

                <div className="contact-list">
                    {filteredContacts.length === 0 ? (
                        <div className="no-contacts">{searchQuery ? 'No contacts found matching your search' : 'No contacts found'}</div>
                    ) : (
                        filteredContacts.map((contact, index) => (
                            <div
                                key={index}
                                className={`contact-item ${activeContact === contact.number ? 'active' : ''} ${selectedContacts.has(contact.number) ? 'selected' : ''}`}
                                onClick={() => {
                                    if (isSelectionMode) {
                                        const newSelected = new Set(selectedContacts);
                                        if (newSelected.has(contact.number)) {
                                            newSelected.delete(contact.number);
                                        } else {
                                            newSelected.add(contact.number);
                                        }
                                        setSelectedContacts(newSelected);
                                    } else {
                                        setActiveContact(contact.number);
                                    }
                                }}
                            >
                                {isSelectionMode && (
                                    <div className={`contact-checkbox ${selectedContacts.has(contact.number) ? 'checked' : ''}`}>
                                        {selectedContacts.has(contact.number) && '✓'}
                                    </div>
                                )}
                                <div className="contact-avatar">
                                    {contact.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="contact-info">
                                    <div className="contact-header">
                                        <span className="contact-name">{contact.name}</span>
                                        {contact.lastMessageTime && (
                                            <span className={`contact-time ${contact.unreadCount > 0 ? 'unread' : ''}`}>
                                                {contact.lastMessageTime}
                                            </span>
                                        )}
                                    </div>
                                    <div className="contact-footer">
                                        <span className="contact-message-preview">
                                            {contact.lastMessageText || contact.number}
                                        </span>
                                        {contact.unreadCount > 0 && (
                                            <span className="unread-badge">{contact.unreadCount}</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Main: Chat Window */}
            <div className={`chat-window ${activeContact ? 'visible-mobile' : ''}`}>
                {activeContact ? (
                    <>
                        <div className="chat-header">
                            <button
                                className="back-btn-mobile icon-btn"
                                onClick={() => setActiveContact(null)}
                                style={{ marginRight: '10px', display: 'none' }} // Hidden by default, shown in mobile css
                            >
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                            </button>
                            <div className="chat-header-avatar">
                                {getDisplayName(activeContact).charAt(0).toUpperCase()}
                            </div>
                            <div className="chat-header-info">
                                <h3>{getDisplayName(activeContact)}</h3>
                                <span>{activeContact}</span>
                            </div>
                        </div>

                        <div className="message-list">
                            {activeMessages.length === 0 ? (
                                <div className="no-messages">
                                    <p>Start a conversation with {getDisplayName(activeContact)}</p>

                                </div>
                            ) : (
                                activeMessages.map((msg, index) => {
                                    console.log('Rendering message:', msg);
                                    return (
                                        <div key={index} className={`message-item ${msg.type === 'sent' ? 'sent' : 'received'}`}>
                                            {/* Render Media */}
                                            {msg.mediaUrl && (
                                                <div className="message-media-container">
                                                    <div className="message-media">
                                                        {msg.type === 'image' && <img src={msg.mediaUrl} alt="Media" />}
                                                        {msg.type === 'video' && <video controls src={msg.mediaUrl} />}
                                                        {msg.type === 'audio' && <audio controls src={msg.mediaUrl} />}
                                                        {msg.type === 'document' && (
                                                            <div className="document-preview">
                                                                <span className="doc-icon">📄</span>
                                                                <span className="doc-name">Document</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <a
                                                        href={msg.mediaUrl}
                                                        download
                                                        className="media-download-btn"
                                                        title="Download"
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                    >
                                                        <FaDownload />
                                                    </a>
                                                </div>
                                            )}

                                            {/* Render Text */}
                                            {msg.text && <div className="message-text">{msg.text}</div>}

                                            <div className="message-time">{msg.time}</div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        <div className="chat-input-area">
                            <input
                                type="file"
                                ref={fileInputRef}
                                style={{ display: 'none' }}
                                onChange={handleFileSelect}
                            />
                            <div className="input-wrapper">
                                <textarea
                                    placeholder="Type a message..."
                                    value={inputMessage}
                                    onChange={(e) => setInputMessage(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSendMessage();
                                        }
                                    }}
                                />
                                <button
                                    className="icon-btn attachment-btn-inside"
                                    onClick={() => fileInputRef.current.click()}
                                    disabled={isUploading || sending}
                                    title="Attach File"
                                >
                                    <FaPaperclip />
                                </button>
                            </div>
                            <div className="action-buttons">
                                <button onClick={handleSendMessage} disabled={sending}>
                                    {sending ? '...' : 'Send'}
                                </button>
                                <button onClick={() => setShowTemplateModal(true)} disabled={sending} className="template-btn">
                                    Template
                                </button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="welcome-screen">
                        <h2>Welcome to WhatsApp Dashboard</h2>
                        <p>Select a contact to start messaging</p>
                    </div>
                )}
            </div>
            {/* Bulk Message Modal */}
            {
                showBulkModal && (
                    <div className="bulk-modal-overlay">
                        <div className="bulk-modal">
                            <h3>Send to {selectedContacts.size} contacts</h3>
                            <textarea
                                value={bulkMessageText}
                                onChange={(e) => setBulkMessageText(e.target.value)}
                                placeholder="Type your message..."
                                autoFocus
                            />
                            <div className="bulk-modal-actions">
                                <button onClick={() => setShowBulkModal(false)} className="cancel-btn">Cancel</button>
                                <button onClick={handleBulkSend} className="send-btn" disabled={sending}>
                                    {sending ? 'Sending...' : 'Send'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
            {/* Template Selection Side Panel */}
            {
                showTemplateModal && (
                    <div className="template-side-panel">
                        <div className="template-panel-header">
                            <button
                                className="back-panel-btn"
                                onClick={() => {
                                    setShowTemplateModal(false);
                                    setShowCreateTemplate(false);
                                }}
                            >
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="15 18 9 12 15 6"></polyline>
                                </svg>
                            </button>
                            <h3>{showCreateTemplate ? 'Create New Template' : 'Select a Template'}</h3>
                            <button onClick={() => {
                                setShowTemplateModal(false);
                                setShowCreateTemplate(false);
                            }} className="close-panel-btn">✕</button>
                        </div>

                        {!showCreateTemplate ? (
                            <>
                                <div className="template-list">
                                    {TEMPLATES.map((template) => {
                                        const isCustom = customTemplates.some(t => t.name === template.name);
                                        return (
                                            <div key={template.name} className="template-item-wrapper">
                                                <button
                                                    className="template-option-btn"
                                                    onClick={() => handleSendTemplate(template.name)}
                                                    disabled={sending}
                                                >
                                                    {template.label}
                                                </button>
                                                {isCustom && (
                                                    <button
                                                        className="template-delete-btn"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDeleteTemplate(template.name);
                                                        }}
                                                        title="Delete template"
                                                    >
                                                        ✕
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="template-panel-footer">
                                    <button
                                        className="create-template-btn"
                                        onClick={() => setShowCreateTemplate(true)}
                                    >
                                        + Create New Template
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="create-template-form">
                                <div className="form-header">
                                    <div className="form-icon">
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                            <polyline points="14 2 14 8 20 8"></polyline>
                                            <line x1="12" y1="18" x2="12" y2="12"></line>
                                            <line x1="9" y1="15" x2="15" y2="15"></line>
                                        </svg>
                                    </div>
                                    <div>
                                        <h4>Create Custom Template</h4>
                                        <p className="form-subtitle">Design a reusable message template</p>
                                    </div>
                                    <button className="ai-assist-btn" onClick={() => alert('AI Assistance coming soon!')} title="Generate with AI">
                                        <FaMagic /> AI Assist
                                    </button>
                                </div>

                                <div className="form-group">
                                    <label htmlFor="template-name">Template Name</label>
                                    <input
                                        id="template-name"
                                        type="text"
                                        placeholder="e.g., order_confirmation"
                                        value={newTemplateName}
                                        onChange={(e) => setNewTemplateName(e.target.value)}
                                        className="template-input"
                                    />
                                    <span className="input-hint">Use lowercase letters and underscores only</span>
                                </div>

                                <div className="form-group">
                                    <label htmlFor="template-label">Display Label</label>
                                    <input
                                        id="template-label"
                                        type="text"
                                        placeholder="e.g., Order Confirmation"
                                        value={newTemplateLabel}
                                        onChange={(e) => setNewTemplateLabel(e.target.value)}
                                        className="template-input"
                                    />
                                    <span className="input-hint">This name will appear in the template list</span>
                                </div>

                                <div className="template-form-actions">
                                    <button onClick={() => setShowCreateTemplate(false)} className="cancel-btn">
                                        Cancel
                                    </button>
                                    <button onClick={handleCreateTemplate} className="save-btn">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="20 6 9 17 4 12"></polyline>
                                        </svg>
                                        Save
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )
            }
        </div >
    );
};

export default Dashboard;
