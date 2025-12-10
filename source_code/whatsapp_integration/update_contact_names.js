/**
 * Script to update contact names from WhatsApp for existing contacts
 * This will fetch names from WhatsApp and update the database
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

async function updateContactNames(userId = 1) {
    console.log(`🔄 Updating contact names for user ${userId}...`);
    
    try {
        const client = whatsappWebService.getClient(userId);
        if (!client || !whatsappWebService.isClientReady(userId)) {
            console.error('❌ WhatsApp client not ready. Please connect WhatsApp first.');
            return;
        }

        // Get all contacts from chats that don't have names
        const result = await pool.query(
            `SELECT DISTINCT wc.contact_number 
             FROM whatsapp_chats wc
             LEFT JOIN whatsapp_contacts wcon ON wc.contact_number = wcon.contact_number AND wc.user_id = wcon.user_id
             WHERE wc.user_id = $1 
             AND wc.is_group = false
             AND (wcon.contact_name IS NULL OR wcon.contact_name = '' OR wcon.contact_name = wc.contact_number)
             LIMIT 50`,
            [userId]
        );

        console.log(`Found ${result.rows.length} contacts without names`);

        let updated = 0;
        for (const row of result.rows) {
            try {
                const contactNumber = row.contact_number;
                // Try different formats
                const formats = [
                    contactNumber,
                    contactNumber.replace(/\s+/g, ''),
                    contactNumber.replace(/^\+/, ''),
                    `+${contactNumber.replace(/^\+/, '')}`,
                    `${contactNumber}@c.us`,
                    contactNumber.includes('@') ? contactNumber : `${contactNumber}@c.us`
                ];

                let contactName = null;
                let contactObj = null;

                for (const format of formats) {
                    try {
                        const contactId = format.includes('@') ? format : `${format}@c.us`;
                        contactObj = await client.getContactById(contactId);
                        if (contactObj) {
                            contactName = contactObj.name || 
                                        contactObj.pushname || 
                                        contactObj.notifyName || 
                                        contactObj.shortName ||
                                        contactObj.verifiedName ||
                                        null;
                            if (contactName) {
                                break;
                            }
                        }
                    } catch (err) {
                        // Try next format
                        continue;
                    }
                }

                if (contactName && contactName.trim() !== '' && contactName !== contactNumber) {
                    // Normalize phone number
                    const normalizedNumber = contactNumber.replace(/\s+/g, '').replace(/^\+/, '');
                    
                    await pool.query(
                        `INSERT INTO whatsapp_contacts (user_id, contact_number, contact_name)
                         VALUES ($1, $2, $3)
                         ON CONFLICT (user_id, contact_number) DO UPDATE SET
                         contact_name = $3`,
                        [userId, normalizedNumber, contactName.trim()]
                    );
                    
                    // Also save with original format
                    if (normalizedNumber !== contactNumber) {
                        await pool.query(
                            `INSERT INTO whatsapp_contacts (user_id, contact_number, contact_name)
                             VALUES ($1, $2, $3)
                             ON CONFLICT (user_id, contact_number) DO UPDATE SET
                             contact_name = $3`,
                            [userId, contactNumber, contactName.trim()]
                        );
                    }
                    
                    console.log(`✅ Updated: ${contactName} (${contactNumber})`);
                    updated++;
                } else {
                    console.log(`⚠️ No name found for ${contactNumber}`);
                }
            } catch (err) {
                console.log(`❌ Error updating ${row.contact_number}: ${err.message}`);
            }
        }

        console.log(`\n✅ Updated ${updated} contact names!`);
        console.log('🔄 Refresh your chat page to see the names!');
    } catch (error) {
        console.error('❌ Error updating contact names:', error);
    } finally {
        await pool.end();
    }
}

// Run if called directly
if (require.main === module) {
    const userId = process.argv[2] || 1;
    updateContactNames(parseInt(userId));
}

module.exports = { updateContactNames };

