const axios = require('axios');

const WHATSAPP_TOKEN = 'EAAQ8MVZA8oo0BQAjgu9hSLLkW9UYMaZANEQGZCh8LZA3flgZBZCOs5Op3toZBaFNBCxMIR7rTi5F1ULctJnD9QADt1XKf4fjFnBBnAEsSna0hbgrZAPgMtAcD3eU3Es3iueLL7WgWdZBebe9SJUzTmu5mEZAzu3PlZB7NFwBODBGT1FJY5A5bZBNf7fXcKpvMU7VqZAprZC6B9iYjTynLV6Mj0PXAC4uJAeM0ZCzBtUtGx3E0RWRssQwh4eDsBxvlHhkzeAP9JodOWVt48JXMjFSj5BamXEHoQZD';

async function verify() {
    try {
        console.log('Verifying token...');
        const response = await axios.get(`https://graph.facebook.com/v17.0/me?access_token=${WHATSAPP_TOKEN}`);
        console.log('Token is VALID.');
        console.log('User ID:', response.data.id);
        console.log('Name:', response.data.name);
    } catch (error) {
        console.error('Token is INVALID or EXPIRED.');
        console.error('Error:', error.response ? error.response.data : error.message);
    }
}

verify();
