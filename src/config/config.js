import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });

export const config = {
  googleMaps: {
    searchQuery: process.env.GOOGLE_MAPS_SEARCH_QUERY || 'businesses near me',
    location: process.env.GOOGLE_MAPS_LOCATION || 'Austin, Texas',
    searchRadius: process.env.GOOGLE_MAPS_SEARCH_RADIUS || '10km',
    maxBusinessesPerRun: parseInt(process.env.MAX_BUSINESSES_PER_RUN) || 100,
    
    // Zone-based scraping configuration (new feature - optional)
    zoneBasedScraping: process.env.ZONE_BASED_SCRAPING === 'true' || false,
    gridSize: parseInt(process.env.GRID_SIZE) || 10, // 10x10 grid
    
    // Austin, Texas boundaries (approximate) - Updated from Bangalore
    bounds: {
      north: parseFloat(process.env.BOUNDS_NORTH) || 30.45,
      south: parseFloat(process.env.BOUNDS_SOUTH) || 30.15,
      east: parseFloat(process.env.BOUNDS_EAST) || -97.65,
      west: parseFloat(process.env.BOUNDS_WEST) || -97.75
    }
  },
  
  scraping: {
    delayMin: parseInt(process.env.SCRAPING_DELAY_MIN) || 3000,
    delayMax: parseInt(process.env.SCRAPING_DELAY_MAX) || 7000,
    headless: process.env.HEADLESS_MODE === 'true'
  },
  
  sheets: {
    sheetId: process.env.GOOGLE_SHEETS_ID,
    credentialsPath: process.env.GOOGLE_SHEETS_CREDENTIALS_PATH || './config/credentials.json'
  },
  
  email: {
    user: process.env.GMAIL_USER,
    password: process.env.GMAIL_APP_PASSWORD,
    fromName: process.env.EMAIL_FROM_NAME || 'Web Development Services',
    maxDailyEmails: parseInt(process.env.MAX_DAILY_EMAILS) || 50,
    sendHour: parseInt(process.env.EMAIL_SEND_HOUR) || 10
  },
  
  business: {
    price: parseInt(process.env.SERVICE_PRICE) || 15000,
    currency: process.env.SERVICE_CURRENCY || 'INR',
    phone: process.env.BUSINESS_PHONE,
    address: process.env.BUSINESS_ADDRESS
  },
  
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'business_scraper',
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 10
  },
  
  scheduling: {
    enableAutoScraping: process.env.ENABLE_AUTO_SCRAPING === 'true',
    enableAutoEmailing: process.env.ENABLE_AUTO_EMAILING === 'true',
    scrapingCron: process.env.SCRAPING_CRON || '0 2 * * *',
    emailCron: process.env.EMAIL_CRON || '0 10 * * *',
    sheetsSyncCron: process.env.SHEETS_SYNC_CRON || '0 */6 * * *'
  }
};

export default config;
