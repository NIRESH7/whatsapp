const axios = require('axios');

const SIMULATION_DATA = [
    {
        from: '919345034653', // The number user mentioned
        text: 'Hello! I am checking if my history appears here.',
        timeOffset: 5000
    },
    {
        from: '15550223344',
        text: 'Hi, I would like to inquire about your services.',
        timeOffset: 4000
    },
    {
        from: '919345034653',
        text: 'Is this the shared inbox?',
        timeOffset: 3000
    },
    {
        from: '15550223344',
        text: 'Do you have a price list?',
        timeOffset: 2000
    }
];

const sendWebhook = async (data) => {
    const payload = {
        object: 'whatsapp_business_account',
        entry: [{
            id: 'WHATSAPP_BUSINESS_ACCOUNT_ID',
            changes: [{
                value: {
                    messaging_product: 'whatsapp',
                    metadata: { display_phone_number: '15556223343', phone_number_id: '921608111027667' },
                    messages: [{
                        from: data.from,
                        id: 'wamid.' + Math.random().toString(36).substring(7),
                        timestamp: Math.floor((Date.now() - data.timeOffset) / 1000),
                        text: { body: data.text },
                        type: 'text'
                    }]
                },
                field: 'messages'
            }]
        }]
    };

    try {
        await axios.post('http://localhost:3000/webhook', payload);
        console.log(`Simulated text from ${data.from}: "${data.text}"`);
    } catch (err) {
        console.error('Error sending webhook:', err.message);
    }
};

(async () => {
    console.log('Starting simulation...');
    for (const msg of SIMULATION_DATA) {
        await sendWebhook(msg);
        await new Promise(r => setTimeout(r, 500)); // Slight delay
    }
    console.log('Simulation complete. Refresh your Dashboard!');
})();
