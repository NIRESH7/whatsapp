const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'postgres',
    password: '2006',
    port: 5432,
});

async function listUsers() {
    try {
        const result = await pool.query('SELECT * FROM users');
        console.log('Users found:', result.rows);
        process.exit(0);
    } catch (error) {
        console.error('Error listing users:', error);
        process.exit(1);
    }
}

listUsers();
