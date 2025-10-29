import initSqlJs from 'sql.js';
import fs from 'fs';

const dbPath = './data/leads.db';

async function checkDatabase() {
  const SQL = await initSqlJs();
  const buffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(buffer);
  
  console.log('\n=== BUSINESSES IN DATABASE ===\n');
  
  const stmt = db.prepare(`
    SELECT id, name, category, address, phone, has_website, rating, review_count, status, created_at
    FROM businesses
    ORDER BY id
  `);
  
  let count = 0;
  while (stmt.step()) {
    const row = stmt.getAsObject();
    count++;
    console.log(`${count}. ${row.name}`);
    console.log(`   Category: ${row.category || 'N/A'}`);
    console.log(`   Address: ${row.address || 'N/A'}`);
    console.log(`   Phone: ${row.phone || 'N/A'}`);
    console.log(`   Website: ${row.has_website ? 'Yes' : 'No'}`);
    console.log(`   Rating: ${row.rating || 'N/A'} (${row.review_count || 0} reviews)`);
    console.log(`   Status: ${row.status}`);
    console.log(`   Created: ${row.created_at}`);
    console.log('');
  }
  stmt.free();
  
  console.log(`\n=== TOTAL: ${count} businesses ===\n`);
  
  db.close();
}

checkDatabase().catch(console.error);
