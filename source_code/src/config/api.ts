// API Configuration - Single Port Setup
const API_BASE_URL = window.location.origin;

export const API_ENDPOINTS = {
    BASE: API_BASE_URL,
    CURRENT_USER: `${API_BASE_URL}/api/current_user`,
    WHATSAPP_INIT: `${API_BASE_URL}/api/whatsapp-web/init`,
    WHATSAPP_SYNC: `${API_BASE_URL}/api/whatsapp-web/sync`,
    WHATSAPP_SEND: `${API_BASE_URL}/api/whatsapp-web/send`,
    WHATSAPP_STATUS: `${API_BASE_URL}/api/whatsapp-web/status`,
    WHATSAPP_MESSAGES: `${API_BASE_URL}/api/whatsapp-web/messages`,
    WHATSAPP_CONTACTS: `${API_BASE_URL}/api/whatsapp-web/contacts`,
    WHATSAPP_CHATS: `${API_BASE_URL}/api/whatsapp-web/chats`,
    CONVERSATIONS: `${API_BASE_URL}/api/whatsapp-business/conversations`,
    MESSAGES: `${API_BASE_URL}/api/whatsapp-business/messages`,
    MESSAGES_BY_CONTACT: (phoneNumber: string) => `${API_BASE_URL}/api/whatsapp-business/messages/${phoneNumber}`,
    SEND_MESSAGE: `${API_BASE_URL}/send`,
    MARK_READ: `${API_BASE_URL}/messages/read`,
    SOCKET_URL: API_BASE_URL,
    LOGIN_REDIRECT: `${API_BASE_URL}/login`
};

export default API_ENDPOINTS;

