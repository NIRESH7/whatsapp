const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'postgres',
    password: '2006',
    port: 5432,
});

async function setupDatabase() {
    try {
        console.log('Creating WhatsApp Web tables...');

        // Table 1: Store WhatsApp Web sessions
        await pool.query(`
            CREATE TABLE IF NOT EXISTS whatsapp_sessions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                session_data TEXT,
                phone_number VARCHAR(20),
                is_active BOOLEAN DEFAULT true,
                last_sync TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id)
            )
        `);
        console.log('✓ whatsapp_sessions table created');

        // Table 2: Store contacts
        await pool.query(`
            CREATE TABLE IF NOT EXISTS whatsapp_contacts (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                contact_number VARCHAR(20),
                contact_name VARCHAR(255),
                profile_pic_url TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, contact_number)
            )
        `);
        console.log('✓ whatsapp_contacts table created');

        // Table 3: Store chat metadata
        await pool.query(`
            CREATE TABLE IF NOT EXISTS whatsapp_chats (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                chat_id VARCHAR(255),
                contact_number VARCHAR(20),
                is_group BOOLEAN DEFAULT false,
                group_name VARCHAR(255),
                last_message_time TIMESTAMP,
                unread_count INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, chat_id)
            )
        `);
        console.log('✓ whatsapp_chats table created');

        // Table 4: Store all messages (synced from WhatsApp Web)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS whatsapp_web_messages (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                message_id VARCHAR(255) UNIQUE,
                chat_id VARCHAR(255),
                sender VARCHAR(20),
                recipient VARCHAR(20),
                message_text TEXT,
                message_type VARCHAR(20),
                media_url TEXT,
                is_from_me BOOLEAN DEFAULT false,
                timestamp TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✓ whatsapp_web_messages table created');

        console.log('\n✅ All tables created successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error creating tables:', error);
        process.exit(1);
    }
}

setupDatabase();
