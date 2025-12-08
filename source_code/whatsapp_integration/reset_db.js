const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'postgres',
    password: '2006',
    port: 5432,
});

pool.query('DROP TABLE IF EXISTS messages')
    .then(() => {
        console.log('Successfully dropped stale messages table.');
        process.exit(0);
    })
    .catch(err => {
        console.error('Error dropping table:', err);
        process.exit(1);
    });
