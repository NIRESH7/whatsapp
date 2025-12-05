const axios = require('axios');

const sendMessage = async () => {
    try {
        const response = await axios.post('http://localhost:3000/send', {
            message: 'you need to pay the due',
            phoneNumber: '919345034653'
        });
        console.log('Success:', response.data);
    } catch (error) {
        console.error('Error:', error.response ? error.response.data : error.message);
    }
};

sendMessage();
