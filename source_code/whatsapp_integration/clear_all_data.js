/**
 * Script to clear ALL WhatsApp data for a user
 * Use this if old data is still showing after scanning new QR
 */

const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'postgres',
    password: '2006',
    port: 5432,
});

async function clearAllData(userId = 1) {
    console.log(`🗑️ Clearing ALL WhatsApp data for user ${userId}...`);
    
    try {
        // Delete all messages
        const messagesResult = await pool.query('DELETE FROM whatsapp_web_messages WHERE user_id = $1', [userId]);
        console.log(`✅ Deleted ${messagesResult.rowCount} messages`);
        
        // Delete all chats
        const chatsResult = await pool.query('DELETE FROM whatsapp_chats WHERE user_id = $1', [userId]);
        console.log(`✅ Deleted ${chatsResult.rowCount} chats`);
        
        // Delete all contacts
        const contactsResult = await pool.query('DELETE FROM whatsapp_contacts WHERE user_id = $1', [userId]);
        console.log(`✅ Deleted ${contactsResult.rowCount} contacts`);
        
        // Clear session data
        await pool.query(
            'UPDATE whatsapp_sessions SET phone_number = NULL, last_sync = NULL, is_active = false WHERE user_id = $1',
            [userId]
        );
        console.log(`✅ Cleared session data`);
        
        console.log(`\n✅ All data cleared for user ${userId}!`);
        console.log('🔄 Now scan a new QR code and sync will fetch fresh data.');
    } catch (error) {
        console.error('❌ Error clearing data:', error);
    } finally {
        await pool.end();
    }
}

// Run if called directly
if (require.main === module) {
    const userId = process.argv[2] || 1;
    clearAllData(parseInt(userId));
}

module.exports = { clearAllData };

