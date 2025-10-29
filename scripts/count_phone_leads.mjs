import mysql from 'mysql2/promise';
import config from '../src/config/config.js';

async function main() {
  const pool = await mysql.createPool({
    host: config.database.host,
    port: config.database.port,
    user: config.database.user,
    password: config.database.password,
    database: config.database.database,
    waitForConnections: true,
    connectionLimit: config.database.connectionLimit,
    queueLimit: 0
  });
  try {
    const [rows1] = await pool.query("SELECT COUNT(*) as cnt FROM businesses WHERE phone IS NOT NULL AND phone != ''");
    const [rows2] = await pool.query("SELECT COUNT(*) as cnt FROM businesses WHERE has_website = 0 AND id NOT IN (SELECT business_id FROM unsubscribes)");
    const [rows3] = await pool.query("SELECT COUNT(*) as cnt FROM businesses WHERE has_website = 0 AND phone IS NOT NULL AND phone != '' AND id NOT IN (SELECT business_id FROM unsubscribes)");
    console.log(JSON.stringify({ total_with_phone: rows1[0].cnt, qualified_total: rows2[0].cnt, qualified_with_phone: rows3[0].cnt }));
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error(err.message || err);
  process.exit(1);
});
