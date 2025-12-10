/**
 * Extract contact names from existing messages and save to contacts table
 * This will look at message senders and extract names from message metadata
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

async function extractNamesFromMessages(userId = 1) {
    console.log(`🔍 Extracting contact names from messages for user ${userId}...`);
    
    try {
        const client = whatsappWebService.getClient(userId);
        const isReady = client && whatsappWebService.isClientReady(userId);
        
        // Get all unique senders from messages
        const messagesResult = await pool.query(
            `SELECT DISTINCT sender, chat_id 
             FROM whatsapp_web_messages 
             WHERE user_id = $1 
             AND is_from_me = false
             AND sender IS NOT NULL
             ORDER BY timestamp DESC`,
            [userId]
        );

        console.log(`Found ${messagesResult.rows.length} unique message senders`);

        let updated = 0;
        const processedNumbers = new Set();

        for (const row of messagesResult.rows) {
            try {
                // Extract phone number from sender (remove @c.us, @g.us, etc.)
                let phoneNumber = row.sender;
                if (phoneNumber && phoneNumber.includes('@')) {
                    phoneNumber = phoneNumber.split('@')[0];
                }
                
                // Skip if already processed
                const normalizedNum = phoneNumber.replace(/\D/g, '');
                if (processedNumbers.has(normalizedNum)) {
                    continue;
                }
                processedNumbers.add(normalizedNum);

                // Check if we already have a name for this contact
                const existingContact = await pool.query(
                    `SELECT contact_name FROM whatsapp_contacts 
                     WHERE user_id = $1 
                     AND (contact_number = $2 OR REPLACE(REPLACE(contact_number, ' ', ''), '+', '') = $3)
                     AND contact_name IS NOT NULL 
                     AND contact_name != '' 
                     AND contact_name != contact_number
                     LIMIT 1`,
                    [userId, phoneNumber, normalizedNum]
                );

                if (existingContact.rows.length > 0 && existingContact.rows[0].contact_name) {
                    console.log(`✓ Already has name: ${existingContact.rows[0].contact_name} (${phoneNumber})`);
                    continue;
                }

                let contactName = null;

                // Try to get name from WhatsApp client if available
                if (isReady) {
                    try {
                        const contactId = `${phoneNumber}@c.us`;
                        const contactObj = await client.getContactById(contactId);
                        if (contactObj) {
                            contactName = contactObj.name || 
                                         contactObj.pushname || 
                                         contactObj.notifyName || 
                                         contactObj.shortName ||
                                         contactObj.verifiedName ||
                                         null;
                            if (contactName) {
                                console.log(`📞 Got name from WhatsApp: ${contactName} (${phoneNumber})`);
                            }
                        }
                    } catch (err) {
                        // Ignore - contact might not be available
                    }
                }

                // If no name from WhatsApp, try to get from recent messages
                if (!contactName) {
                    const recentMessages = await pool.query(
                        `SELECT sender, chat_id 
                         FROM whatsapp_web_messages 
                         WHERE user_id = $1 
                         AND sender LIKE $2
                         AND is_from_me = false
                         ORDER BY timestamp DESC
                         LIMIT 10`,
                        [userId, `%${phoneNumber}%`]
                    );

                    // Try to extract name from chat_id or other metadata
                    // WhatsApp sometimes stores names in chat metadata
                    for (const msg of recentMessages.rows) {
                        if (msg.chat_id && msg.chat_id.includes(phoneNumber)) {
                            // Chat ID might contain name info
                            const parts = msg.chat_id.split('@');
                            if (parts[0] && parts[0] !== phoneNumber && !parts[0].match(/^\d+$/)) {
                                contactName = parts[0];
                                break;
                            }
                        }
                    }
                }

                // Save the name if we found one
                if (contactName && contactName.trim() !== '' && contactName !== phoneNumber) {
                    const cleanName = contactName.trim();
                    const nameDigits = cleanName.replace(/\D/g, '');
                    const numDigits = phoneNumber.replace(/\D/g, '');
                    
                    // Don't save if name is just digits matching the number
                    if (nameDigits !== numDigits) {
                        // Save with normalized number
                        const normalizedNumber = phoneNumber.replace(/\s+/g, '').replace(/^\+/, '');
                        
                        await pool.query(
                            `INSERT INTO whatsapp_contacts (user_id, contact_number, contact_name)
                             VALUES ($1, $2, $3)
                             ON CONFLICT (user_id, contact_number) DO UPDATE SET
                             contact_name = COALESCE(NULLIF($3, ''), whatsapp_contacts.contact_name)`,
                            [userId, normalizedNumber, cleanName]
                        );
                        
                        // Also save with original format if different
                        if (normalizedNumber !== phoneNumber) {
                            await pool.query(
                                `INSERT INTO whatsapp_contacts (user_id, contact_number, contact_name)
                                 VALUES ($1, $2, $3)
                                 ON CONFLICT (user_id, contact_number) DO UPDATE SET
                                 contact_name = COALESCE(NULLIF($3, ''), whatsapp_contacts.contact_name)`,
                                [userId, phoneNumber, cleanName]
                            );
                        }
                        
                        console.log(`✅ Saved: ${cleanName} (${phoneNumber})`);
                        updated++;
                    }
                } else {
                    console.log(`⚠️ No name found for ${phoneNumber}`);
                }
            } catch (err) {
                console.log(`❌ Error processing ${row.sender}: ${err.message}`);
            }
        }

        console.log(`\n✅ Extracted and saved ${updated} contact names!`);
        console.log('🔄 Refresh your chat page to see the names!');
    } catch (error) {
        console.error('❌ Error extracting names:', error);
    } finally {
        await pool.end();
    }
}

// Run if called directly
if (require.main === module) {
    const userId = process.argv[2] || 1;
    extractNamesFromMessages(parseInt(userId));
}

module.exports = { extractNamesFromMessages };

