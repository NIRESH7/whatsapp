const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'postgres',
    password: '2006',
    port: 5432,
});

async function fixSchema() {
    try {
        console.log('Fixing database schema...');

        // Fix whatsapp_web_messages table
        await pool.query('ALTER TABLE whatsapp_web_messages ALTER COLUMN message_id TYPE VARCHAR(255)');
        await pool.query('ALTER TABLE whatsapp_web_messages ALTER COLUMN chat_id TYPE VARCHAR(255)');
        await pool.query('ALTER TABLE whatsapp_web_messages ALTER COLUMN sender TYPE VARCHAR(255)');
        await pool.query('ALTER TABLE whatsapp_web_messages ALTER COLUMN message_text TYPE TEXT');

        // Fix whatsapp_chats table
        await pool.query('ALTER TABLE whatsapp_chats ALTER COLUMN chat_id TYPE VARCHAR(255)');
        await pool.query('ALTER TABLE whatsapp_chats ALTER COLUMN contact_number TYPE VARCHAR(255)');
        await pool.query('ALTER TABLE whatsapp_chats ALTER COLUMN group_name TYPE VARCHAR(255)');

        // Fix whatsapp_contacts table
        await pool.query('ALTER TABLE whatsapp_contacts ALTER COLUMN contact_number TYPE VARCHAR(255)');
        await pool.query('ALTER TABLE whatsapp_contacts ALTER COLUMN contact_name TYPE VARCHAR(255)');

        console.log('Schema fixed successfully!');
    } catch (error) {
        console.error('Error fixing schema:', error);
    } finally {
        await pool.end();
    }
}

fixSchema();
