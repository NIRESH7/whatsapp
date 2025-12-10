const fs = require('fs');
const path = require('path');

const sessionsDir = path.join(__dirname, 'whatsapp-sessions');

console.log('🧹 Cleaning old WhatsApp sessions...');

if (fs.existsSync(sessionsDir)) {
    const sessions = fs.readdirSync(sessionsDir);
    let deleted = 0;
    
    sessions.forEach(session => {
        const sessionPath = path.join(sessionsDir, session);
        try {
            if (fs.statSync(sessionPath).isDirectory()) {
                fs.rmSync(sessionPath, { recursive: true, force: true });
                console.log(`✅ Deleted: ${session}`);
                deleted++;
            }
        } catch (err) {
            console.error(`❌ Error deleting ${session}:`, err.message);
        }
    });
    
    console.log(`\n✅ Cleaned ${deleted} session(s). QR code will generate fresh now!`);
} else {
    console.log('ℹ️ No sessions folder found.');
}

console.log('\n🚀 Restart your server and try connecting again!');

