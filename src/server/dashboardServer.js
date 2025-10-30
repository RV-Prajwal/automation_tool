import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';
import { 
  getStats, 
  getQualifiedLeads,
  getMetrics,
  getTodayMetrics,
  dbReady 
} from '../utils/database.js';
import GoogleMapsScraper from '../scrapers/googleMapsScraper.js';
import BusinessProcessor from '../processors/businessProcessor.js';
import OutreachManager from '../services/outreachManager.js';
import ZoneManager from '../utils/zoneManager.js';
import config from '../config/config.js';
// Removed test data generator import

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class DashboardServer {
  constructor(appConfig = {}) {
    this.app = express();
    this.port = process.env.DASHBOARD_PORT || 3000;
    this.scraper = new GoogleMapsScraper();
    this.processor = new BusinessProcessor();
    this.outreachManager = new OutreachManager();
    this.zoneManager = new ZoneManager(appConfig.googleMaps || {});
    this.useZoneBasedScraping = config.googleMaps?.zoneBasedScraping || false;
    this.isScrapingActive = false;
  }

  setupMiddleware() {
    this.app.use(express.json());
    this.app.use(express.static(path.join(__dirname, '../../dashboard/dist')));
    
    // CORS for development
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Headers', 'Content-Type');
      next();
    });
  }

  setupRoutes() {
    // API Routes
    
    // Dashboard stats
    this.app.get('/api/stats', async (req, res) => {
      try {
        await dbReady;
        const stats = await getStats();
        const todayMetrics = await getTodayMetrics();
        
        res.json({
          success: true,
          data: {
            ...stats,
            todayMetrics
          }
        });
      } catch (error) {
        logger.error('Stats API error:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Get leads
    this.app.get('/api/leads', async (req, res) => {
      try {
        await dbReady;
        const limit = parseInt(req.query.limit) || 50;
        const leads = await getQualifiedLeads(limit);
        
        res.json({
          success: true,
          data: leads
        });
      } catch (error) {
        logger.error('Leads API error:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Get metrics
    this.app.get('/api/metrics', async (req, res) => {
      try {
        await dbReady;
        const days = parseInt(req.query.days) || 30;
        const endDate = new Date().toISOString().split('T')[0];
        const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        const metrics = await getMetrics(startDate, endDate);
        
        res.json({
          success: true,
          data: metrics
        });
      } catch (error) {
        logger.error('Metrics API error:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Manual scraping trigger - Uses zone-based if enabled, otherwise traditional
    this.app.post('/api/scrape', async (req, res) => {
      try {
        const useTestData = req.body?.useTestData || false;
        const scrapingMode = this.useZoneBasedScraping ? 'zone-based' : 'traditional';
        logger.info(`Manual scraping triggered via dashboard (mode: ${scrapingMode}, test data: ${useTestData})`);
        
    // Run in background
        this.runScraping().catch(err => {
          logger.error('Background scraping failed:', err);
        });
        
        res.json({
          success: true,
          message: `Scraping job started (${scrapingMode} mode) - Will continue until stopped`,
          mode: scrapingMode
        });
      } catch (error) {
        logger.error('Scrape trigger error:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });
    
    // Stop scraping
    this.app.post('/api/stop-scrape', async (req, res) => {
      try {
        logger.info('Scraping stop requested via dashboard');
        this.isScrapingActive = false;
        
        res.json({
          success: true,
          message: 'Scraping will stop after current zone completes'
        });
      } catch (error) {
        logger.error('Stop scrape error:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });
    
    // Removed test data generation endpoints
    
    // Manual email campaign trigger
    this.app.post('/api/email-campaign', async (req, res) => {
      try {
        logger.info('Manual email campaign triggered via dashboard');
        
        // Run in background
        this.runEmailCampaign().catch(err => {
          logger.error('Background email campaign failed:', err);
        });
        
        res.json({
          success: true,
          message: 'Email campaign started'
        });
      } catch (error) {
        logger.error('Email campaign trigger error:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Zone-based scraping API endpoints
    
    // Get zone statistics
    this.app.get('/api/zone-stats', async (req, res) => {
      try {
        await dbReady;
        const stats = await this.zoneManager.getZoneStats();
        const isReady = await this.zoneManager.isZoneSystemReady();
        
        res.json({
          success: true,
          data: {
            ...stats,
            systemReady: isReady
          }
        });
      } catch (error) {
        logger.error('Zone stats API error:', error);
        // Return empty stats if zones not initialized
        res.json({
          success: true,
          data: {
            total_zones: 0,
            pending_zones: 0,
            in_progress_zones: 0,
            completed_zones: 0,
            total_businesses_found: 0,
            systemReady: false,
            message: 'Zone system not initialized. Run: node scripts/initializeZones.js'
          }
        });
      }
    });

    // Get all zones
    this.app.get('/api/zones', async (req, res) => {
      try {
        await dbReady;
        const zones = await this.zoneManager.getAllZones();
        
        res.json({
          success: true,
          data: zones
        });
      } catch (error) {
        logger.error('Zones API error:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Reset all zones
    this.app.post('/api/reset-zones', async (req, res) => {
      try {
        await dbReady;
        const resetCount = await this.zoneManager.resetAllZones();
        
        res.json({
          success: true,
          message: `Reset ${resetCount} zones to pending status`,
          data: { zones_reset: resetCount }
        });
      } catch (error) {
        logger.error('Reset zones API error:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Initialize zones
    this.app.post('/api/initialize-zones', async (req, res) => {
      try {
        await dbReady;
        const result = await this.zoneManager.initializeZones();
        
        res.json({
          success: true,
          message: 'Zones initialized successfully',
          data: result
        });
      } catch (error) {
        logger.error('Initialize zones API error:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Export qualified leads phone numbers as CSV
    this.app.get('/api/export-sms-list', async (req, res) => {
      try {
        await dbReady;
        const { getSmsQualifiedLeads } = await import('../utils/database.js');
        const rows = await getSmsQualifiedLeads();
        
        if (rows.length === 0) {
          return res.status(404).json({ success: false, message: 'No qualified leads with phone numbers found' });
        }
        
        // Create CSV content
        let csv = 'ID,Business Name,Phone,Category,Address\n';
        rows.forEach(row => {
          const name = `"${row.name.replace(/"/g, '""')}"`;
          const category = row.category || '';
          const address = `"${(row.address || '').replace(/"/g, '""')}"`;
          csv += `${row.id},${name},${row.phone},${category},${address}\n`;
        });
        
        // Send CSV file
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="qualified-leads-sms.csv"');
        res.send(csv);
        
        logger.info(`Exported ${rows.length} qualified leads (no website) to SMS list CSV`);
      } catch (error) {
        logger.error('Export SMS list API error:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Get qualified leads SMS list as JSON
    this.app.get('/api/sms-list', async (req, res) => {
      try {
        await dbReady;
        const { getSmsQualifiedLeads } = await import('../utils/database.js');
        const rows = await getSmsQualifiedLeads();
        
        res.json({
          success: true,
          total: rows.length,
          message: `${rows.length} qualified leads ready for SMS outreach (businesses without websites)`,
          data: rows
        });
        
        logger.info(`Retrieved ${rows.length} qualified leads for SMS`);
      } catch (error) {
        logger.error('SMS list API error:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Serve frontend
    this.app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, '../../dashboard/dist/index.html'));
    });
  }

  async runScraping() {
    try {
      if (this.useZoneBasedScraping) {
        logger.info('=== Starting continuous zone-based scraping ===');
        this.isScrapingActive = true;
        
        // Continuous scraping loop
        while (this.isScrapingActive) {
          const zone = await this.zoneManager.getNextPendingZone();
          
          if (!zone) {
            logger.info('All zones completed! Resetting for next cycle...');
            await this.zoneManager.resetAllZones();
            const nextZone = await this.zoneManager.getNextPendingZone();
            if (!nextZone) {
              logger.warn('No zones available after reset!');
              this.isScrapingActive = false;
              return;
            }
          }
          
          if (!this.isScrapingActive) break;
          await this.scrapeSingleZone(zone || await this.zoneManager.getNextPendingZone());
          
          // Small delay between zones to avoid overload
          if (this.isScrapingActive) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
        
        logger.info('Continuous scraping stopped');
      }
    } catch (error) {
      logger.error('Error in runScraping:', error);
      this.isScrapingActive = false;
    }
  }

  async scrapeSingleZone(zone) {
    try {
      // Mark zone as in progress
      await this.zoneManager.markZoneInProgress(zone.id);
      
      logger.info(`Scraping zone from dashboard: ${zone.zone_name}`);
      logger.info(`Zone bounds: Lat ${zone.latitude_min} to ${zone.latitude_max}, Lon ${zone.longitude_min} to ${zone.longitude_max}`);
      
      // Scrape with zone coordinates
      const result = await this.scraper.scrape(10, zone);
      const businesses = result.businesses || result;
      
      // Process and qualify leads
      const processingResults = await this.processor.processBatch(businesses);
      
      // Mark zone as completed
      await this.zoneManager.markZoneCompleted(zone.id, processingResults.qualified);
      
      logger.info(`Zone ${zone.zone_name} completed: ${processingResults.qualified} new qualified leads`);
    } catch (error) {
      logger.error(`Error scraping zone ${zone?.zone_name}:`, error);
    }
  }

  async runEmailCampaign() {
    await this.outreachManager.runCombinedCampaign();
    logger.info('Manual email campaign completed');
  }

  async start() {
    await dbReady;
    
    this.setupMiddleware();
    this.setupRoutes();

    this.app.listen(this.port, () => {
      logger.info(`Dashboard server running on http://localhost:${this.port}`);
      console.log(`\n🚀 Dashboard: http://localhost:${this.port}\n`);
    });
  }
}

export default DashboardServer;
