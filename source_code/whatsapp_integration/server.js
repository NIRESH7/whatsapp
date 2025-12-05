const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const FormData = require('form-data');
const session = require('express-session');
const passport = require('passport');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(session({ secret: 'keyboard cat', resave: false, saveUninitialized: false }));
app.use(passport.initialize());
app.use(passport.session());

// Configure Multer (Memory Storage)
const upload = multer({ storage: multer.memoryStorage() });

const MY_VERIFY_TOKEN = '36EetLnemILdOPuDM9g41lqX2X2_6zUBPZUiVr77BMEw1zZac';
const WHATSAPP_TOKEN = 'EAAQ8MVZA8oo0BQHzeyzZBZA4qYseDAo60WtAG1oZCryqOZB1BIrrTG3cgzlHSiZCgvs8iLIYQi5SYaKcGgw9gr4zURPbqEPg4MjZBnZAAGWgvMLkqTiZApamKNvZAcK9y7zNO31NFZArBLbz9e0mspYfkCm61PnRUICoYZBQIY4wOrpLsiK71ZBcRzBlT0JhpTp5co3XoIO1nWJxJ27C8PJcbOrYZAJ1pjbGw9GjdXVPmltzWoR9HOGUZC6bOgRsntlXTfh0JJmeqZAwrW3y0oKxIgFetaZAVfgZDZD';
const PHONE_NUMBER_ID = '921608111027667';

// In-memory message storage
let messages = [
    {
        id: 'debug_sent_1',
        sender: 'Me',
        recipient: '919345034653', // Number from user screenshot
        text: 'This is a debug sent message. Can you see me?',
        time: new Date().toLocaleTimeString(),
        timestamp: new Date().toISOString(),
        type: 'sent'
    }
];
console.log('Initializing message storage...');

// Helper to download media
const downloadMedia = async (mediaId) => {
    try {
        console.log(`[downloadMedia] Starting download for ID: ${mediaId}`);
        // 1. Get Media URL
        const urlResponse = await axios.get(`https://graph.facebook.com/v17.0/${mediaId}`, {
            headers: { 'Authorization': `Bearer ${WHATSAPP_TOKEN}` }
        });
        const mediaUrl = urlResponse.data.url;
        const mimeType = urlResponse.data.mime_type;
        console.log(`[downloadMedia] Got URL: ${mediaUrl}, Mime: ${mimeType}`);

        // Better extension handling
        let extension = mimeType.split('/')[1].split(';')[0];
        if (mimeType === 'application/pdf') extension = 'pdf';
        else if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) extension = 'xlsx';
        else if (mimeType.includes('word') || mimeType.includes('document')) extension = 'docx';
        else if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) extension = 'pptx';
        else if (mimeType === 'text/plain') extension = 'txt';
        else if (mimeType === 'text/csv') extension = 'csv';

        // 2. Download Media Binary
        const mediaResponse = await axios.get(mediaUrl, {
            headers: { 'Authorization': `Bearer ${WHATSAPP_TOKEN}` },
            responseType: 'arraybuffer'
        });
        console.log(`[downloadMedia] Downloaded binary. Size: ${mediaResponse.data.length}`);

        // 3. Save to file
        const fileName = `${mediaId}.${extension}`;
        const uploadDir = path.join(__dirname, 'client', 'public', 'uploads');

        // Ensure directory exists
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        const filePath = path.join(uploadDir, fileName);
        fs.writeFileSync(filePath, mediaResponse.data);

        console.log(`[downloadMedia] Media saved to: ${filePath}`);
        return `/uploads/${fileName}`; // Return path relative to public folder
    } catch (error) {
        console.error('[downloadMedia] Error downloading media:', error.message);
        if (error.response) {
            console.error('[downloadMedia] API Error:', JSON.stringify(error.response.data, null, 2));
        }
        return null;
    }
};

// Webhook verification
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === MY_VERIFY_TOKEN) {
            console.log('WEBHOOK_VERIFIED');
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    } else {
        res.sendStatus(400);
    }
});

// Incoming messages
app.post('/webhook', async (req, res) => {
    const body = req.body;

    console.log('Incoming webhook:', JSON.stringify(body, null, 2));

    if (body.object) {
        if (
            body.entry &&
            body.entry[0].changes &&
            body.entry[0].changes[0] &&
            body.entry[0].changes[0].value.messages &&
            body.entry[0].changes[0].value.messages[0]
        ) {
            const message = body.entry[0].changes[0].value.messages[0];
            console.log('Received message:', message);

            let msgText = '[Media/Other]';
            let msgType = 'received';
            let mediaUrl = null;

            if (message.type === 'text') {
                msgText = message.text.body;
            } else if (message.type === 'image') {
                msgText = message.image.caption || '[Image]';
                msgType = 'image';
                console.log('Downloading image media:', message.image.id);
                mediaUrl = await downloadMedia(message.image.id);
                console.log('Image mediaUrl:', mediaUrl);
            } else if (message.type === 'document') {
                msgText = message.document.caption || message.document.filename || '[Document]';
                msgType = 'document';
                console.log('Downloading document media:', message.document.id);
                mediaUrl = await downloadMedia(message.document.id);
            } else if (message.type === 'video') {
                msgText = message.video.caption || '[Video]';
                msgType = 'video';
                console.log('Downloading video media:', message.video.id);
                mediaUrl = await downloadMedia(message.video.id);
            } else if (message.type === 'audio') {
                msgText = '[Audio]';
                msgType = 'audio';
                console.log('Downloading audio media:', message.audio.id);
                mediaUrl = await downloadMedia(message.audio.id);
            }

            // Store incoming message
            const incomingMsg = {
                id: message.id,
                sender: message.from,
                text: msgText,
                time: new Date().toLocaleTimeString(),
                timestamp: new Date().toISOString(),
                type: msgType,
                mediaUrl: mediaUrl,
                read: false // Default to unread
            };
            messages.push(incomingMsg);
            console.log('Stored incoming message:', JSON.stringify(incomingMsg, null, 2));
            console.log('Total messages:', messages.length);
        }
        res.sendStatus(200);
    } else {
        res.sendStatus(404);
    }
});

// Mark messages as read for a specific contact
app.post('/messages/read', (req, res) => {
    const { phoneNumber } = req.body;
    if (!phoneNumber) {
        return res.status(400).json({ error: 'Phone number is required' });
    }

    let updatedCount = 0;
    messages.forEach(msg => {
        if (msg.sender === phoneNumber && !msg.read) {
            msg.read = true;
            updatedCount++;
        }
    });

    console.log(`Marked ${updatedCount} messages as read for ${phoneNumber}`);
    res.json({ success: true, updatedCount });
});

// Get all messages
app.get('/messages', (req, res) => {
    // console.log('GET /messages called. Current count:', messages.length);
    res.json(messages);
});

// Send message
app.post('/send', async (req, res) => {
    const { message, phoneNumber } = req.body;

    if (!message || !phoneNumber) {
        return res.status(400).json({ error: 'Message and phoneNumber are required' });
    }

    try {
        console.log(`Attempting to send message to: ${phoneNumber}, Content: ${message}`);
        const response = await axios({
            method: 'POST',
            url: `https://graph.facebook.com/v17.0/${PHONE_NUMBER_ID}/messages`,
            headers: {
                'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
                'Content-Type': 'application/json',
            },
            data: {
                messaging_product: 'whatsapp',
                to: phoneNumber,
                text: { body: message },
            },
        });

        console.log('Message sent:', response.data);

        // Store sent message
        const sentMsg = {
            id: response.data.messages[0].id,
            sender: 'Me',
            recipient: phoneNumber, // Added recipient
            text: message,
            time: new Date().toLocaleTimeString(),
            timestamp: new Date().toISOString(),
            type: 'sent'
        };
        messages.push(sentMsg);
        console.log('Stored sent message. Total messages:', messages.length);

        res.status(200).json({ success: true, data: response.data });
    } catch (error) {
        console.error('Error sending message:', error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
        res.status(500).json({ error: 'Failed to send message', details: error.response ? error.response.data : error.message });
    }
});

// Helper to upload media to WhatsApp
const uploadToWhatsApp = async (fileBuffer, mimeType, originalName) => {
    try {
        const form = new FormData();
        form.append('file', fileBuffer, { filename: originalName, contentType: mimeType });
        form.append('type', mimeType.split('/')[0]); // 'image', 'video', 'document'
        form.append('messaging_product', 'whatsapp');

        const response = await axios.post(
            `https://graph.facebook.com/v17.0/${PHONE_NUMBER_ID}/media`,
            form,
            {
                headers: {
                    'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
                    ...form.getHeaders()
                }
            }
        );
        return response.data.id;
    } catch (error) {
        console.error('Error uploading to WhatsApp:', error.response ? error.response.data : error.message);
        throw error;
    }
};

// Send Media Message
app.post('/send-media', upload.single('file'), async (req, res) => {
    const { phoneNumber, caption } = req.body;
    const file = req.file;

    if (!file || !phoneNumber) {
        return res.status(400).json({ error: 'File and phoneNumber are required' });
    }

    try {
        // 1. Upload to WhatsApp
        console.log(`Uploading ${file.originalname} to WhatsApp...`);
        const mediaId = await uploadToWhatsApp(file.buffer, file.mimetype, file.originalname);
        console.log(`Media uploaded. ID: ${mediaId}`);

        // 2. Determine message type
        let messageType = 'document';
        if (file.mimetype.startsWith('image/')) messageType = 'image';
        else if (file.mimetype.startsWith('video/')) messageType = 'video';
        else if (file.mimetype.startsWith('audio/')) messageType = 'audio';

        // 3. Send Message
        const messagePayload = {
            messaging_product: 'whatsapp',
            to: phoneNumber,
            type: messageType,
            [messageType]: {
                id: mediaId,
                caption: caption || file.originalname
            }
        };

        const response = await axios.post(
            `https://graph.facebook.com/v17.0/${PHONE_NUMBER_ID}/messages`,
            messagePayload,
            {
                headers: {
                    'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
                    'Content-Type': 'application/json',
                }
            }
        );

        console.log('Media message sent:', response.data);

        // 4. Store in history
        const sentMsg = {
            id: response.data.messages[0].id,
            sender: 'Me',
            recipient: phoneNumber,
            text: caption || `[${messageType.charAt(0).toUpperCase() + messageType.slice(1)}]`,
            mediaUrl: null, // We don't have a public URL for sent media easily without downloading it back, but we could blob it locally if needed. For now, text placeholder.
            mediaUrl: null, // We don't have a public URL for sent media easily without downloading it back, but we could blob it locally if needed. For now, text placeholder.
            time: new Date().toLocaleTimeString(),
            timestamp: new Date().toISOString(),
            type: 'sent' // We could differentiate 'sent-image' etc if we want specific rendering for sent media
        };
        messages.push(sentMsg);

        res.status(200).json({ success: true, data: response.data });

    } catch (error) {
        console.error('Error sending media:', error);
        res.status(500).json({ error: 'Failed to send media' });
    }
});

// Send template message
app.post('/send-template', async (req, res) => {
    const { templateName, phoneNumber, languageCode } = req.body;

    if (!templateName || !phoneNumber) {
        return res.status(400).json({ error: 'templateName and phoneNumber are required' });
    }

    try {
        const response = await axios({
            method: 'POST',
            url: `https://graph.facebook.com/v17.0/${PHONE_NUMBER_ID}/messages`,
            headers: {
                'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
                'Content-Type': 'application/json',
            },
            data: {
                messaging_product: 'whatsapp',
                to: phoneNumber,
                type: 'template',
                template: {
                    name: templateName,
                    language: {
                        code: languageCode || 'en_US'
                    }
                },
            },
        });

        console.log('Template sent:', response.data);

        // Store sent template message (optional, but good for history)
        const sentMsg = {
            id: response.data.messages[0].id,
            sender: 'Me',
            recipient: phoneNumber, // Added recipient
            text: `[Template: ${templateName}]`,
            time: new Date().toLocaleTimeString(),
            timestamp: new Date().toISOString(),
            type: 'sent'
        };
        messages.push(sentMsg);
        console.log('Stored sent template. Total messages:', messages.length);

        res.status(200).json({ success: true, data: response.data });
    } catch (error) {
        console.error('Error sending template:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Failed to send template', details: error.response ? error.response.data : error.message });
    }
});

// Auth Routes
require('dotenv').config();
const LocalStrategy = require('passport-local').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;

// Database Connection
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'postgres', // Default DB, can be changed if user has a specific one
    password: '2006',
    port: 5432,
});

// Create Users Table
pool.query(`
    CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255),
        name VARCHAR(255),
        google_id VARCHAR(255),
        github_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
`).then(() => console.log('Users table ready'))
    .catch(err => console.error('DB Error:', err));

// Serialize/Deserialize User
passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
        done(null, result.rows[0]);
    } catch (err) {
        done(err, null);
    }
});

// Local Strategy
passport.use(new LocalStrategy({
    usernameField: 'email',
    passwordField: 'password'
},
    async (email, password, done) => {
        try {
            const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
            const user = result.rows[0];

            if (!user) {
                return done(null, false, { message: 'Incorrect email.' });
            }

            if (!user.password) {
                return done(null, false, { message: 'Please login with Google/GitHub.' });
            }

            const match = await bcrypt.compare(password, user.password);
            if (match) {
                return done(null, user);
            } else {
                return done(null, false, { message: 'Incorrect password.' });
            }
        } catch (err) {
            return done(err);
        }
    }
));

// Google Strategy

// Google Strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'YOUR_GOOGLE_CLIENT_SECRET',
    callbackURL: "http://localhost:3000/auth/google/callback"
},
    function (accessToken, refreshToken, profile, cb) {
        // In a real app, you'd save the user to DB here
        return cb(null, profile);
    }
));

// GitHub Strategy
passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID || 'YOUR_GITHUB_CLIENT_ID',
    clientSecret: process.env.GITHUB_CLIENT_SECRET || 'YOUR_GITHUB_CLIENT_SECRET',
    callbackURL: "http://localhost:3000/auth/github/callback"
},
    function (accessToken, refreshToken, profile, done) {
        return done(null, profile);
    }
));

// Google Routes
app.get('/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/login' }),
    function (req, res) {
        res.redirect('http://localhost:5173?loggedin=true');
    });

// Local Login Route
app.post('/auth/login', (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
        if (err) { return next(err); }
        if (!user) { return res.status(401).json({ error: info ? info.message : 'Invalid credentials' }); }
        req.logIn(user, (err) => {
            if (err) { return next(err); }
            return res.json({ success: true, user });
        });
    })(req, res, next);
});

// Register Route
app.post('/auth/register', async (req, res) => {
    const { email, password, name } = req.body;
    try {
        const check = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (check.rows.length > 0) {
            return res.status(400).json({ error: 'Email already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await pool.query(
            'INSERT INTO users (email, password, name) VALUES ($1, $2, $3) RETURNING *',
            [email, hashedPassword, name || 'User']
        );
        const user = result.rows[0];

        req.logIn(user, (err) => {
            if (err) { return res.status(500).json({ error: 'Login failed after registration' }); }
            return res.json({ success: true, user });
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Forgot Password Route
const crypto = require('crypto');
const resetTokens = new Map(); // token -> { email, expires }

app.post('/auth/forgot-password', async (req, res) => {
    const { email } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        const user = result.rows[0];

        if (!user) return res.status(404).json({ error: 'User not found' });

        const token = crypto.randomBytes(20).toString('hex');
        resetTokens.set(token, { email, expires: Date.now() + 3600000 }); // 1 hour

        const link = `http://localhost:5174/?resetToken=${token}`;
        console.log(`\n==================================================`);
        console.log(`[SIMULATION] Password Reset Link: ${link}`);
        console.log(`==================================================\n`);

        res.json({ success: true, message: 'Reset link sent (check server console)' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

app.post('/auth/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;
    const resetData = resetTokens.get(token);

    if (!resetData || resetData.expires < Date.now()) {
        return res.status(400).json({ error: 'Invalid or expired token' });
    }

    try {
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await pool.query('UPDATE users SET password = $1 WHERE email = $2', [hashedPassword, resetData.email]);

        resetTokens.delete(token);
        res.json({ success: true, message: 'Password updated successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// GitHub Routes
app.get('/auth/github',
    passport.authenticate('github', { scope: ['user:email'] }));

app.get('/auth/github/callback',
    passport.authenticate('github', { failureRedirect: '/login' }),
    function (req, res) {
        res.redirect('http://localhost:5173?loggedin=true');
    });

app.get('/api/current_user', (req, res) => {
    res.send(req.user);
});

app.get('/api/logout', (req, res) => {
    req.logout((err) => {
        if (err) { return next(err); }
        res.redirect('http://localhost:5173');
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});
