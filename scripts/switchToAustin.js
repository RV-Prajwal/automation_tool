import mysql from 'mysql2/promise';
import config from '../src/config/config.js';
import logger from '../src/utils/logger.js';
import ZoneManager from '../src/utils/zoneManager.js';
import { dbReady } from '../src/utils/database.js';

async function switchToAustin() {
  try {
    console.log('\n========================================');
    console.log('Switching from Bangalore to Austin, TX');
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
    
    // Clear old zones
    console.log('Clearing old Bangalore zones...');
    const conn = await pool.getConnection();
    const [result] = await conn.execute('DELETE FROM scraped_zones');
    console.log(`✓ Deleted ${result.affectedRows} old zones\n`);
    conn.release();
    
    // Initialize new Austin zones
    console.log('Initializing new Austin, Texas zones...');
    const zoneManager = new ZoneManager(config.googleMaps);
    
    console.log('Austin Configuration:');
    console.log(`- Grid Size: ${zoneManager.gridSize}x${zoneManager.gridSize}`);
    console.log(`- Total Zones: ${zoneManager.gridSize * zoneManager.gridSize}`);
    console.log(`- Austin Bounds:`);
    console.log(`  North: ${zoneManager.bounds.north}`);
    console.log(`  South: ${zoneManager.bounds.south}`);
    console.log(`  East: ${zoneManager.bounds.east}`);
    console.log(`  West: ${zoneManager.bounds.west}\n`);
    
    const initResult = await zoneManager.initializeZones();
    console.log(`✓ Austin Zones Initialized`);
    console.log(`  - New Zones: ${initResult.insertedCount}`);
    console.log(`  - Total: ${initResult.totalZones}\n`);
    
    // Get stats
    const stats = await zoneManager.getZoneStats();
    console.log('Zone Coverage Statistics:');
    console.log(`- Total Zones: ${stats.total_zones}`);
    console.log(`- Pending Zones: ${stats.pending_zones}`);
    console.log(`- In Progress Zones: ${stats.in_progress_zones}`);
    console.log(`- Completed Zones: ${stats.completed_zones}\n`);
    
    console.log('========================================');
    console.log('✓ Successfully switched to Austin!');
    console.log('========================================\n');
    
    console.log('Next Steps:');
    console.log('1. Start the scraper: npm run pm2:start');
    console.log('2. Monitor with: npm run pm2:logs\n');
    
    pool.end();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Switch Failed:');
    console.error(error.message);
    process.exit(1);
  }
}

switchToAustin();
