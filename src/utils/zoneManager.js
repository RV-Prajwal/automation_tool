import logger from './logger.js';
import mysql from 'mysql2/promise';
import config from '../config/config.js';

// Create pool (will be initialized on first use)
let pool = null;

async function getPool() {
  if (pool) return pool;
  
  try {
    pool = mysql.createPool({
      host: config.database.host,
      port: config.database.port,
      user: config.database.user,
      password: config.database.password,
      database: config.database.database,
      waitForConnections: true,
      connectionLimit: config.database.connectionLimit,
      queueLimit: 0
    });
    return pool;
  } catch (error) {
    logger.error('Failed to create pool in ZoneManager:', error);
    throw error;
  }
}

class ZoneManager {
  constructor(config) {
    // Austin, Texas boundaries (approximate) - Updated from Bangalore
    this.bounds = config?.bounds || {
      north: 30.45,
      south: 30.15,
      east: -97.65,
      west: -97.75
    };
    
    this.gridSize = config?.gridSize || 10; // 10x10 grid
    this.zoneType = 'grid';
  }

  /**
   * Generate grid zones for Bangalore
   * Returns array of zone objects with boundaries and center coordinates
   */
  generateGridZones() {
    const zones = [];
    const { north, south, east, west } = this.bounds;
    
    const latStep = (north - south) / this.gridSize;
    const lonStep = (east - west) / this.gridSize;
    
    let zoneIndex = 1;
    
    for (let row = 0; row < this.gridSize; row++) {
      for (let col = 0; col < this.gridSize; col++) {
        const latMin = south + (row * latStep);
        const latMax = latMin + latStep;
        const lonMin = west + (col * lonStep);
        const lonMax = lonMin + lonStep;
        
        const centerLat = (latMin + latMax) / 2;
        const centerLon = (lonMin + lonMax) / 2;
        
        zones.push({
          zone_name: `Grid_${row}_${col}`,
          zone_type: 'grid',
          latitude_min: parseFloat(latMin.toFixed(8)),
          latitude_max: parseFloat(latMax.toFixed(8)),
          longitude_min: parseFloat(lonMin.toFixed(8)),
          longitude_max: parseFloat(lonMax.toFixed(8)),
          center_latitude: parseFloat(centerLat.toFixed(8)),
          center_longitude: parseFloat(centerLon.toFixed(8)),
          status: 'pending'
        });
      }
    }
    
    logger.info(`Generated ${zones.length} grid zones for Austin, Texas`);
    return zones;
  }

  /**
   * Initialize zones in database (safe - won't duplicate existing zones)
   */
  async initializeZones() {
    try {
      const zones = this.generateGridZones();
      let insertedCount = 0;
      let skippedCount = 0;
      
      const currentPool = await getPool();
      
      for (const zone of zones) {
        try {
          // Insert only if zone doesn't exist
          const [result] = await currentPool.query(
            `INSERT IGNORE INTO scraped_zones 
             (zone_name, zone_type, latitude_min, latitude_max, longitude_min, longitude_max, center_latitude, center_longitude, status) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              zone.zone_name,
              zone.zone_type,
              zone.latitude_min,
              zone.latitude_max,
              zone.longitude_min,
              zone.longitude_max,
              zone.center_latitude,
              zone.center_longitude,
              zone.status
            ]
          );
          
          if (result.affectedRows > 0) {
            insertedCount++;
          } else {
            skippedCount++;
          }
        } catch (error) {
          logger.error(`Error inserting zone ${zone.zone_name}:`, error.message);
        }
      }
      
      logger.info(`Zone initialization complete. Inserted: ${insertedCount}, Skipped (existed): ${skippedCount}`);
      return { insertedCount, skippedCount, totalZones: zones.length };
    } catch (error) {
      logger.error('Failed to initialize zones:', error);
      throw error;
    }
  }

  /**
   * Get the next pending zone to scrape
   */
  async getNextPendingZone() {
    try {
      const currentPool = await getPool();
      const [zones] = await currentPool.query(
        `SELECT * FROM scraped_zones 
         WHERE status = 'pending' 
         ORDER BY last_scraped_at ASC 
         LIMIT 1`
      );
      
      return zones.length > 0 ? zones[0] : null;
    } catch (error) {
      logger.error('Error getting next pending zone:', error);
      throw error;
    }
  }

  /**
   * Get all zones with their status
   */
  async getAllZones() {
    try {
      const currentPool = await getPool();
      const [zones] = await currentPool.query(
        `SELECT * FROM scraped_zones ORDER BY zone_name`
      );
      return zones;
    } catch (error) {
      logger.error('Error getting all zones:', error);
      throw error;
    }
  }

  /**
   * Mark zone as in progress
   */
  async markZoneInProgress(zoneId) {
    try {
      const currentPool = await getPool();
      await currentPool.query(
        `UPDATE scraped_zones SET status = 'in_progress' WHERE id = ?`,
        [zoneId]
      );
      logger.info(`Zone ${zoneId} marked as in_progress`);
    } catch (error) {
      logger.error(`Error marking zone ${zoneId} as in_progress:`, error);
      throw error;
    }
  }

  /**
   * Mark zone as completed
   */
  async markZoneCompleted(zoneId, businessCount = 0) {
    try {
      const currentPool = await getPool();
      await currentPool.query(
        `UPDATE scraped_zones 
         SET status = 'completed', 
             last_scraped_at = NOW(),
             business_count = business_count + ? 
         WHERE id = ?`,
        [businessCount, zoneId]
      );
      logger.info(`Zone ${zoneId} marked as completed with ${businessCount} new businesses`);
    } catch (error) {
      logger.error(`Error marking zone ${zoneId} as completed:`, error);
      throw error;
    }
  }

  /**
   * Reset all completed zones back to pending for re-scraping
   */
  async resetAllZones() {
    try {
      const currentPool = await getPool();
      const [result] = await currentPool.query(
        `UPDATE scraped_zones SET status = 'pending' WHERE status = 'completed'`
      );
      logger.info(`Reset ${result.affectedRows} completed zones to pending status`);
      return result.affectedRows;
    } catch (error) {
      logger.error('Error resetting zones:', error);
      throw error;
    }
  }

  /**
   * Get zone coverage statistics
   */
  async getZoneStats() {
    try {
      const currentPool = await getPool();
      const [stats] = await currentPool.query(
        `SELECT 
         COUNT(*) as total_zones,
         SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_zones,
         SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_zones,
         SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_zones,
         SUM(business_count) as total_businesses_found
         FROM scraped_zones`
      );
      return stats[0] || {};
    } catch (error) {
      logger.error('Error getting zone statistics:', error);
      throw error;
    }
  }

  /**
   * Check if zone-based scraping is configured and ready
   */
  async isZoneSystemReady() {
    try {
      const stats = await this.getZoneStats();
      return stats.total_zones > 0;
    } catch (error) {
      logger.warn('Zone system not ready:', error.message);
      return false;
    }
  }
}

export default ZoneManager;
