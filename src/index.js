import cron from 'node-cron';
import logger from './utils/logger.js';
import config from './config/config.js';
import GoogleMapsScraper from './scrapers/googleMapsScraper.js';
import BusinessProcessor from './processors/businessProcessor.js';
import OutreachManager from './services/outreachManager.js';
import { getStats, dbReady } from './utils/database.js';
import DashboardServer from './server/dashboardServer.js';
import ZoneManager from './utils/zoneManager.js';

class AutomationApp {
  constructor() {
    this.scraper = new GoogleMapsScraper();
    this.processor = new BusinessProcessor();
    this.outreachManager = new OutreachManager();
    this.dashboardServer = new DashboardServer(config);
    this.zoneManager = new ZoneManager(config.googleMaps);
    this.jobs = [];
    this.useZoneScraping = config.googleMaps.zoneBasedScraping;
  }

  async runScrapingJob() {
    try {
      // Check if zone-based scraping is enabled
      if (this.useZoneScraping) {
        logger.info('=== Starting zone-based scraping job ===');
        return await this.runZoneBasedScrapingJob();
      } else {
        logger.info('=== Starting traditional scraping job ===');
        return await this.runTraditionalScrapingJob();
      }
    } catch (error) {
      logger.error('Scraping job failed:', error);
      throw error;
    }
  }

  async runTraditionalScrapingJob() {
    try {
      // Original behavior - scrape entire location
      const businesses = await this.scraper.scrape(config.googleMaps.maxBusinessesPerRun);
      const results = await this.processor.processBatch(businesses);
      
      logger.info(`Traditional scraping completed: ${results.qualified} new qualified leads`);
      return results;
    } catch (error) {
      logger.error('Traditional scraping job failed:', error);
      throw error;
    }
  }

  async runZoneBasedScrapingJob() {
    try {
      // Get next pending zone
      const zone = await this.zoneManager.getNextPendingZone();
      
      if (!zone) {
        logger.info('All zones completed! Resetting for next cycle...');
        await this.zoneManager.resetAllZones();
        const nextZone = await this.zoneManager.getNextPendingZone();
        if (!nextZone) {
          logger.warn('No zones available after reset!');
          return { processed: 0, qualified: 0 };
        }
        return await this.scrapeSingleZone(nextZone);
      }
      
      return await this.scrapeSingleZone(zone);
    } catch (error) {
      logger.error('Zone-based scraping job failed:', error);
      throw error;
    }
  }

  async scrapeSingleZone(zone) {
    try {
      // Mark zone as in progress
      await this.zoneManager.markZoneInProgress(zone.id);
      
      logger.info(`Scraping zone: ${zone.zone_name}`);
      logger.info(`Zone bounds: Lat ${zone.latitude_min} to ${zone.latitude_max}, Lon ${zone.longitude_min} to ${zone.longitude_max}`);
      
      // Scrape with zone coordinates
      const result = await this.scraper.scrape(config.googleMaps.maxBusinessesPerRun, zone);
      const businesses = result.businesses || result;
      
      // Process and qualify leads
      const processingResults = await this.processor.processBatch(businesses);
      
      // Mark zone as completed
      await this.zoneManager.markZoneCompleted(zone.id, processingResults.qualified);
      
      logger.info(`Zone ${zone.zone_name} completed: ${processingResults.qualified} new qualified leads`);
      
      return processingResults;
    } catch (error) {
      logger.error(`Error scraping zone ${zone.zone_name}:`, error);
      throw error;
    }
  }

  async runEmailJob() {
    try {
      logger.info('=== Starting email job ===');
      
      const results = await this.outreachManager.runCombinedCampaign();
      
      logger.info('Email job completed');
      
      return results;
    } catch (error) {
      logger.error('Email job failed:', error);
      throw error;
    }
  }


  async healthCheck() {
    try {
      const stats = getStats();
      logger.info('Health check:', {
        totalBusinesses: stats.total_businesses,
        withoutWebsite: stats.without_website,
        newLeads: stats.new_leads,
        contacted: stats.contacted,
        converted: stats.converted,
        emailsSentToday: stats.emails_sent_today
      });
    } catch (error) {
      logger.error('Health check failed:', error);
    }
  }

  setupScheduledJobs() {
    logger.info('Setting up scheduled jobs...');

    // Daily scraping at 2 AM
    if (config.scheduling.enableAutoScraping) {
      const scrapingJob = cron.schedule(config.scheduling.scrapingCron, async () => {
        logger.info('Triggered: Daily scraping job');
        await this.runScrapingJob();
      }, {
        timezone: 'Asia/Kolkata'
      });
      this.jobs.push({ name: 'scraping', job: scrapingJob });
      logger.info(`Scheduled scraping job: ${config.scheduling.scrapingCron}`);
    }

    // Daily email campaign at 10 AM
    if (config.scheduling.enableAutoEmailing) {
      const emailJob = cron.schedule(config.scheduling.emailCron, async () => {
        logger.info('Triggered: Daily email job');
        await this.runEmailJob();
      }, {
        timezone: 'Asia/Kolkata'
      });
      this.jobs.push({ name: 'email', job: emailJob });
      logger.info(`Scheduled email job: ${config.scheduling.emailCron}`);
    }

    // Health check every hour
    const healthJob = cron.schedule('0 * * * *', async () => {
      await this.healthCheck();
    }, {
      timezone: 'Asia/Kolkata'
    });
    this.jobs.push({ name: 'health', job: healthJob });
    logger.info('Scheduled health check: every hour');
  }

  async start() {
    try {
      logger.info('========================================');
      logger.info('Business Scraper & Outreach Automation');
      logger.info('========================================');
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`Location: ${config.googleMaps.location}`);
      logger.info(`Search Query: ${config.googleMaps.searchQuery}`);
      logger.info('========================================');

      // Wait for database initialization
      await dbReady;
      logger.info('Database ready');

      // Run initial health check
      await this.healthCheck();

      // Setup scheduled jobs
      this.setupScheduledJobs();

      // Start dashboard server
      await this.dashboardServer.start();

      logger.info('Application started successfully');
      logger.info('Waiting for scheduled jobs...');
      
      // Signal PM2 that app is ready
      if (process.send) {
        process.send('ready');
      }

      // Run immediate scraping job on startup (optional)
      // Uncomment if you want to run scraping immediately on start
      // await this.runScrapingJob();

    } catch (error) {
      logger.error('Failed to start application:', error);
      process.exit(1);
    }
  }

  async stop() {
    logger.info('Stopping application...');
    
    // Stop all cron jobs
    this.jobs.forEach(({ name, job }) => {
      job.stop();
      logger.info(`Stopped ${name} job`);
    });

    logger.info('Application stopped');
    process.exit(0);
  }
}

// Create and start application
const app = new AutomationApp();

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Received SIGINT signal');
  await app.stop();
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM signal');
  await app.stop();
});

// Start the application
app.start().catch(error => {
  logger.error('Unhandled error:', error);
  process.exit(1);
});

export default app;
