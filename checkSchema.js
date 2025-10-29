import mysql from 'mysql2/promise';

async function checkSchema() {
  try {
    const pool = mysql.createPool({
      host: 'localhost',
      port: 3306,
      user: 'root',
      password: '',
      database: 'business_scraper'
    });
    
    const conn = await pool.getConnection();
    const [columns] = await conn.execute('DESCRIBE businesses');
    console.log('Businesses table columns:');
    columns.forEach(col => console.log(`- ${col.Field} (${col.Type})`));
    
    const [count] = await conn.execute('SELECT COUNT(*) as count FROM businesses');
    console.log(`\nTotal businesses: ${count[0].count}`);
    
    conn.release();
    pool.end();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkSchema();