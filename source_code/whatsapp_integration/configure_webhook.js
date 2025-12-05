const axios = require('axios');

const TOKEN = 'EAAQ8MVZA8oo0BQAjgu9hSLLkW9UYMaZANEQGZCh8LZA3flgZBZCOs5Op3toZBaFNBCxMIR7rTi5F1ULctJnD9QADt1XKf4fjFnBBnAEsSna0hbgrZAPgMtAcD3eU3Es3iueLL7WgWdZBebe9SJUzTmu5mEZAzu3PlZB7NFwBODBGT1FJY5A5bZBNf7fXcKpvMU7VqZAprZC6B9iYjTynLV6Mj0PXAC4uJAeM0ZCzBtUtGx3E0RWRssQwh4eDsBxvlHhkzeAP9JodOWVt48JXMjFSj5BamXEHoQZD';
const WEBHOOK_URL = 'https://kam-unsyllogistic-bacterioscopically.ngrok-free.dev/webhook';
const VERIFY_TOKEN = 'MY_VERIFY_TOKEN';

async function configure() {
    try {
        // 1. Get App ID
        console.log('Verifying token...');
        const debugResponse = await axios.get(`https://graph.facebook.com/v17.0/debug_token`, {
            params: {
                input_token: TOKEN,
                access_token: TOKEN
            }
        });

        const appId = debugResponse.data.data.app_id;
        console.log('App ID:', appId);

        // 2. Configure Webhook
        console.log('Configuring Webhook...');
        const response = await axios.post(`https://graph.facebook.com/v17.0/${appId}/subscriptions`, null, {
            params: {
                object: 'whatsapp_business_account',
                callback_url: WEBHOOK_URL,
                verify_token: VERIFY_TOKEN,
                fields: 'messages',
                access_token: TOKEN
            }
        });

        console.log('Success!', response.data);
    } catch (error) {
        console.error('Error:', error.response ? error.response.data : error.message);
    }
}

configure();
