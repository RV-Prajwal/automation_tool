import initSqlJs from 'sql.js';
import fs from 'fs';

const dbPath = './data/leads.db';

async function clearTestData() {
  const SQL = await initSqlJs();
  const buffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(buffer);
  
  console.log('Clearing test data...');
  
  db.run('DELETE FROM businesses');
  db.run('DELETE FROM outreach_history');
  db.run('DELETE FROM metrics');
  
  console.log('✓ All data cleared');
  
  // Save database
  const data = db.export();
  fs.writeFileSync(dbPath, data);
  
  console.log('✓ Database saved');
  
  db.close();
}

clearTestData().catch(console.error);
