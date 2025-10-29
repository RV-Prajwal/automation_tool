/**
 * Zone Initialization Script
 * Run this ONCE to populate the scraped_zones table with grid zones
 * 
 * Usage: node scripts/initializeZones.js
 * 
 * This script:
 * 1. Connects to the database
 * 2. Creates a ZoneManager instance
 * 3. Generates 10x10 grid zones for Bangalore
 * 4. Inserts them into the scraped_zones table (without duplicates)
 * 5. Displays coverage statistics
 */

import config from '../src/config/config.js';
import logger from '../src/utils/logger.js';
import ZoneManager from '../src/utils/zoneManager.js';
import { dbReady } from '../src/utils/database.js';

async function initializeZones() {
  try {
    console.log('\n========================================');
    console.log('Zone Initialization Script');
    console.log('========================================\n');
    
    // Wait for database to be ready
    console.log('Connecting to database...');
    await dbReady;
    console.log('✓ Database connected\n');
    
    // Create zone manager with config
    const zoneManager = new ZoneManager(config.googleMaps);
    
    console.log('Zone Configuration:');
    console.log(`- Grid Size: ${zoneManager.gridSize}x${zoneManager.gridSize}`);
    console.log(`- Total Zones: ${zoneManager.gridSize * zoneManager.gridSize}`);
    console.log(`- Bangalore Bounds:`);
    console.log(`  North: ${zoneManager.bounds.north}`);
    console.log(`  South: ${zoneManager.bounds.south}`);
    console.log(`  East: ${zoneManager.bounds.east}`);
    console.log(`  West: ${zoneManager.bounds.west}\n`);
    
    console.log('Initializing zones...\n');
    
    // Initialize zones
    const result = await zoneManager.initializeZones();
    
    console.log('✓ Zone Initialization Complete');
    console.log(`  - Zones Inserted: ${result.insertedCount}`);
    console.log(`  - Zones Skipped (already existed): ${result.skippedCount}`);
    console.log(`  - Total Zones: ${result.totalZones}\n`);
    
    // Get and display statistics
    const stats = await zoneManager.getZoneStats();
    
    console.log('Zone Coverage Statistics:');
    console.log(`- Total Zones: ${stats.total_zones}`);
    console.log(`- Pending Zones: ${stats.pending_zones}`);
    console.log(`- In Progress Zones: ${stats.in_progress_zones}`);
    console.log(`- Completed Zones: ${stats.completed_zones}`);
    console.log(`- Total Businesses Found: ${stats.total_businesses_found || 0}\n`);
    
    console.log('========================================');
    console.log('Zone initialization successful!');
    console.log('========================================\n');
    
    console.log('Next Steps:');
    console.log('1. Enable zone-based scraping in .env: ZONE_BASED_SCRAPING=true');
    console.log('2. Start the automation: npm run pm2:start');
    console.log('3. Monitor progress with: npm run pm2:logs\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Zone Initialization Failed:');
    console.error(error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Ensure MySQL database is running');
    console.error('2. Check database connection in .env');
    console.error('3. Verify schema.sql has been executed');
    console.error('\nFor detailed error:');
    console.error(error);
    process.exit(1);
  }
}

// Run initialization
initializeZones();
