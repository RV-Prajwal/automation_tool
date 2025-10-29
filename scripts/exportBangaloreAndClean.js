import mysql from 'mysql2/promise';
import fs from 'fs';
import config from '../src/config/config.js';
import logger from '../src/utils/logger.js';
import { dbReady } from '../src/utils/database.js';

async function exportAndCleanBangalore() {
  try {
    console.log('\n========================================');
    console.log('Export Bangalore Leads & Clean Database');
    console.log('========================================\n');
    
    // Wait for database
    console.log('Connecting to database...');
    await dbReady;
    console.log('✓ Database connected\n');
    
    // Create pool
    const pool = mysql.createPool({
      host: config.database.host,
      port: config.database.port,
      user: config.database.user,
      password: config.database.password,
      database: config.database.database
    });
    
    const conn = await pool.getConnection();
    
    // 1. Export all businesses (Bangalore data)
    console.log('1. Exporting Bangalore businesses...');
    const [businesses] = await conn.execute(`
      SELECT id, name, category, address, phone, email, has_website, 
             rating, review_count, created_at, status, priority_score, notes,
             latitude, longitude, last_contacted_at
      FROM businesses 
      ORDER BY created_at DESC
    `);
    
    if (businesses.length > 0) {
      // Create CSV for businesses
      let csvContent = 'ID,Name,Category,Address,Phone,Email,Has_Website,Rating,Review_Count,Priority_Score,Status,Notes,Latitude,Longitude,Created_At,Last_Contacted_At\n';
      
      businesses.forEach(row => {
        const name = `"${(row.name || '').replace(/"/g, '""')}"`;
        const category = `"${(row.category || '').replace(/"/g, '""')}"`;
        const address = `"${(row.address || '').replace(/"/g, '""')}"`;
        const phone = row.phone || '';
        const email = row.email || '';
        const notes = `"${(row.notes || '').replace(/"/g, '""')}"`;
        
        csvContent += `${row.id},${name},${category},${address},${phone},${email},${row.has_website ? 'Yes' : 'No'},${row.rating || ''},${row.review_count || ''},${row.priority_score || ''},${row.status || ''},${notes},${row.latitude || ''},${row.longitude || ''},${row.created_at},${row.last_contacted_at || ''}\n`;
      });
      
      fs.writeFileSync('./exports/bangalore_businesses.csv', csvContent);
      console.log(`✓ Exported ${businesses.length} businesses to ./exports/bangalore_businesses.csv`);
    } else {
      console.log('No businesses found to export');
    }
    
    // 2. Export qualified leads
    console.log('2. Exporting qualified leads...');
    const [qualifiedLeads] = await conn.execute(`
      SELECT id, name, category, address, phone, email, 
             has_website, rating, review_count, created_at, 
             priority_score, status, latitude, longitude
      FROM businesses 
      WHERE status = 'qualified' OR has_website = 0
      ORDER BY created_at DESC
    `);
    
    if (qualifiedLeads.length > 0) {
      // Create CSV for qualified leads
      let leadsContent = 'ID,Name,Category,Address,Phone,Email,Has_Website,Rating,Review_Count,Priority_Score,Status,Latitude,Longitude,Created_At\n';
      
      qualifiedLeads.forEach(row => {
        const name = `"${(row.name || '').replace(/"/g, '""')}"`;
        const category = `"${(row.category || '').replace(/"/g, '""')}"`;
        const address = `"${(row.address || '').replace(/"/g, '""')}"`;
        const phone = row.phone || '';
        const email = row.email || '';
        
        leadsContent += `${row.id},${name},${category},${address},${phone},${email},${row.has_website ? 'Yes' : 'No'},${row.rating || ''},${row.review_count || ''},${row.priority_score || ''},${row.status || ''},${row.latitude || ''},${row.longitude || ''},${row.created_at}\n`;
      });
      
      fs.writeFileSync('./exports/bangalore_qualified_leads.csv', leadsContent);
      console.log(`✓ Exported ${qualifiedLeads.length} qualified leads to ./exports/bangalore_qualified_leads.csv`);
    } else {
      console.log('No qualified leads found to export');
    }
    
    // 3. Export email campaigns (if any)
    console.log('3. Exporting email campaigns...');
    try {
      const [campaigns] = await conn.execute(`
        SELECT * FROM email_campaigns ORDER BY sent_at DESC
      `);
      
      if (campaigns.length > 0) {
        let campaignsContent = 'ID,Business_ID,Email,Subject,Status,Sent_At,Response_At,Response_Type\n';
        campaigns.forEach(row => {
          const subject = `"${(row.subject || '').replace(/"/g, '""')}"`;
          campaignsContent += `${row.id},${row.business_id},${row.email},${subject},${row.status},${row.sent_at || ''},${row.response_at || ''},${row.response_type || ''}\n`;
        });
        
        fs.writeFileSync('./exports/bangalore_email_campaigns.csv', campaignsContent);
        console.log(`✓ Exported ${campaigns.length} email campaigns to ./exports/bangalore_email_campaigns.csv`);
      } else {
        console.log('No email campaigns found');
      }
    } catch (error) {
      if (error.message.includes("doesn't exist")) {
        console.log('No email_campaigns table found (skipping)');
      } else {
        throw error;
      }
    }
    
    // 4. Show statistics before deletion
    console.log('\n--- Current Database Statistics ---');
    const [stats] = await conn.execute(`
      SELECT 
        COUNT(*) as total_businesses,
        COUNT(CASE WHEN has_website = 0 THEN 1 END) as without_website,
        COUNT(CASE WHEN status = 'qualified' THEN 1 END) as qualified,
        COUNT(CASE WHEN phone IS NOT NULL AND phone != '' THEN 1 END) as with_phone
      FROM businesses
    `);
    
    if (stats[0]) {
      console.log(`- Total Businesses: ${stats[0].total_businesses}`);
      console.log(`- Without Website: ${stats[0].without_website}`);
      console.log(`- Qualified: ${stats[0].qualified}`);
      console.log(`- With Phone: ${stats[0].with_phone}`);
    }
    
    // 5. Clear all business data (keep Austin zones)
    console.log('\n5. Cleaning database...');
    
    // Delete email campaigns first (foreign key dependency) - if table exists
    try {
      const [emailResult] = await conn.execute('DELETE FROM email_campaigns');
      console.log(`✓ Deleted ${emailResult.affectedRows} email campaigns`);
    } catch (error) {
      if (error.message.includes("doesn't exist")) {
        console.log('✓ No email_campaigns table to clean');
      } else {
        throw error;
      }
    }
    
    // Delete businesses
    const [businessResult] = await conn.execute('DELETE FROM businesses');
    console.log(`✓ Deleted ${businessResult.affectedRows} businesses`);
    
    // Keep scraped_zones (they're already Austin zones)
    console.log('✓ Kept Austin zones in scraped_zones table');
    
    console.log('\n========================================');
    console.log('✅ Export and Cleanup Complete!');
    console.log('========================================\n');
    
    console.log('Files created:');
    console.log('- ./exports/bangalore_businesses.csv');
    console.log('- ./exports/bangalore_qualified_leads.csv');
    console.log('- ./exports/bangalore_email_campaigns.csv\n');
    
    console.log('Database now clean and ready for Austin scraping!');
    
    conn.release();
    pool.end();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Export/Cleanup Failed:');
    console.error(error.message);
    process.exit(1);
  }
}

exportAndCleanBangalore();