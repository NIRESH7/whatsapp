const axios = require('axios');

const sendTemplate = async () => {
    try {
        const response = await axios.post('http://localhost:3000/send-template', {
            templateName: 'hello_world',
            phoneNumber: '919345034653',
            languageCode: 'en_US'
        });
        console.log('Success:', response.data);
    } catch (error) {
        console.error('Error:', error.response ? error.response.data : error.message);
    }
};

sendTemplate();
