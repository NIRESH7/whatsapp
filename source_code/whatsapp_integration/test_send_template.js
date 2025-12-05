const axios = require('axios');

const WHATSAPP_TOKEN = 'EAAQ8MVZA8oo0BQAjgu9hSLLkW9UYMaZANEQGZCh8LZA3flgZBZCOs5Op3toZBaFNBCxMIR7rTi5F1ULctJnD9QADt1XKf4fjFnBBnAEsSna0hbgrZAPgMtAcD3eU3Es3iueLL7WgWdZBebe9SJUzTmu5mEZAzu3PlZB7NFwBODBGT1FJY5A5bZBNf7fXcKpvMU7VqZAprZC6B9iYjTynLV6Mj0PXAC4uJAeM0ZCzBtUtGx3E0RWRssQwh4eDsBxvlHhkzeAP9JodOWVt48JXMjFSj5BamXEHoQZD';
const PHONE_NUMBER_ID = '921608111027667';
const TO_NUMBER = '919345034653';

async function sendTemplate() {
    try {
        console.log(`Sending template to ${TO_NUMBER}...`);
        const response = await axios({
            method: 'POST',
            url: `https://graph.facebook.com/v17.0/${PHONE_NUMBER_ID}/messages`,
            headers: {
                'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
                'Content-Type': 'application/json',
            },
            data: {
                messaging_product: 'whatsapp',
                to: TO_NUMBER,
                type: 'template',
                template: {
                    name: 'hello_world',
                    language: {
                        code: 'en_US'
                    }
                },
            },
        });
        console.log('Success:', response.data);
    } catch (error) {
        console.error('Failed to send message.');
        if (error.response) {
            console.error('Error Data:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error('Error:', error.message);
        }
    }
}

sendTemplate();
