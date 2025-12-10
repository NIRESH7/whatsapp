/**
 * Script to refresh contact names from WhatsApp
 * Run this after syncing to update contact names
 */

const { Pool } = require('pg');
const whatsappWebService = require('./whatsapp-web-service');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'postgres',
    password: '2006',
    port: 5432,
});

async function refreshContactNames(userId = 1) {
    console.log(`🔄 Refreshing contact names for user ${userId}...`);
    
    try {
        const client = whatsappWebService.getClient(userId);
        if (!client || !whatsappWebService.isClientReady(userId)) {
            console.error('❌ WhatsApp client not ready. Please connect WhatsApp first.');
            return;
        }

        // Get all contacts from database that don't have names
        const result = await pool.query(
            `SELECT DISTINCT contact_number 
             FROM whatsapp_chats 
             WHERE user_id = $1 
             AND contact_number NOT IN (
                 SELECT contact_number FROM whatsapp_contacts 
                 WHERE user_id = $1 AND contact_name IS NOT NULL AND contact_name != ''
             )`,
            [userId]
        );

        console.log(`Found ${result.rows.length} contacts without names`);

        // Try to get contact info from WhatsApp
        for (const row of result.rows) {
            try {
                const contactNumber = row.contact_number;
                const contactId = `${contactNumber}@c.us`;
                
                // Try to get contact info
                const contact = await client.getContactById(contactId);
                
                if (contact) {
                    const contactName = contact.name || contact.pushname || null;
                    
                    if (contactName && contactName.trim() !== '' && contactName !== contactNumber) {
                        await pool.query(
                            `INSERT INTO whatsapp_contacts (user_id, contact_number, contact_name)
                             VALUES ($1, $2, $3)
                             ON CONFLICT (user_id, contact_number) DO UPDATE SET
                             contact_name = $3`,
                            [userId, contactNumber, contactName.trim()]
                        );
                        console.log(`✅ Updated: ${contactName} (${contactNumber})`);
                    }
                }
            } catch (err) {
                // Ignore individual errors
                console.log(`⚠️ Could not get name for ${row.contact_number}: ${err.message}`);
            }
        }

        console.log('✅ Contact name refresh complete!');
    } catch (error) {
        console.error('❌ Error refreshing contact names:', error);
    } finally {
        await pool.end();
    }
}

// Run if called directly
if (require.main === module) {
    const userId = process.argv[2] || 1;
    refreshContactNames(parseInt(userId));
}

module.exports = { refreshContactNames };

