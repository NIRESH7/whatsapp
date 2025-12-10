const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'postgres',
    password: '2006',
    port: 5432,
});

async function deleteUsers(ids) {
    try {
        console.log(`Deleting users with IDs: ${ids.join(', ')}`);

        for (const userId of ids) {
            console.log(`Processing User ID: ${userId}`);

            // Delete from child tables first
            await pool.query('DELETE FROM whatsapp_web_messages WHERE user_id = $1', [userId]);
            await pool.query('DELETE FROM whatsapp_chats WHERE user_id = $1', [userId]);
            await pool.query('DELETE FROM whatsapp_contacts WHERE user_id = $1', [userId]);
            await pool.query('DELETE FROM whatsapp_sessions WHERE user_id = $1', [userId]);
            await pool.query('DELETE FROM users WHERE id = $1', [userId]);

            console.log(`- Deleted User ID ${userId}`);
        }

        console.log('Successfully deleted users.');
        process.exit(0);

    } catch (error) {
        console.error('Error deleting users:', error);
        process.exit(1);
    }
}

// Deleting the test accounts found: 3, 4, 5
deleteUsers([3, 4, 5]);
