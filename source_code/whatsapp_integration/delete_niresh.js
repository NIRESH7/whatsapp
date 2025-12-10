const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'postgres',
    password: '2006',
    port: 5432,
});

async function deleteUser(email) {
    try {
        console.log(`Searching for user with email: ${email}`);
        const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

        if (userResult.rows.length === 0) {
            console.log('User not found.');
            process.exit(0);
        }

        const userId = userResult.rows[0].id;
        console.log(`Found user ID: ${userId}. Deleting data...`);

        // Delete from child tables first
        await pool.query('DELETE FROM whatsapp_web_messages WHERE user_id = $1', [userId]);
        console.log('- Deleted messages');

        await pool.query('DELETE FROM whatsapp_chats WHERE user_id = $1', [userId]);
        console.log('- Deleted chats');

        await pool.query('DELETE FROM whatsapp_contacts WHERE user_id = $1', [userId]);
        console.log('- Deleted contacts');

        await pool.query('DELETE FROM whatsapp_sessions WHERE user_id = $1', [userId]);
        console.log('- Deleted sessions');

        // Delete user
        await pool.query('DELETE FROM users WHERE id = $1', [userId]);
        console.log('- Deleted user account');

        console.log('Successfully deleted user and all associated data.');
        process.exit(0);

    } catch (error) {
        console.error('Error deleting user:', error);
        process.exit(1);
    }
}

deleteUser('nireshtorantoranto@gmail.com');
