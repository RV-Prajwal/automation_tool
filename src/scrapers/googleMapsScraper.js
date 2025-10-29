import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import logger from '../utils/logger.js';
import config from '../config/config.js';
import { delay, getRandomUserAgent } from '../utils/validator.js';

// Use stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

class GoogleMapsScraper {
  constructor() {
    this.browser = null;
    this.page = null;
    this.currentZone = null; // Track current zone being scraped
    this.userDataDir = null; // Track temp directory for cleanup
  }

  async initialize() {
    try {
      logger.info('Launching browser with anti-detection...');
      
      // Use a fresh user data directory to avoid any cached location data
      this.userDataDir = `./temp_browser_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const userDataDir = this.userDataDir;
      
      this.browser = await puppeteer.launch({
        headless: false, // Use headed mode for better success
        userDataDir, // Fresh profile every time
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-blink-features=AutomationControlled',
          '--disable-web-security',
          '--disable-features=IsolateOrigins,site-per-process',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--disable-features=TranslateUI',
          '--disable-ipc-flooding-protection',
          '--window-size=1920,1080',
          '--start-maximized',
          '--disable-infobars',
          '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ],
        defaultViewport: null
      });

      const pages = await this.browser.pages();
      this.page = pages[0] || await this.browser.newPage();
      
      // Advanced anti-detection
      await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      // Set realistic viewport
      await this.page.setViewport({ 
        width: 1920, 
        height: 1080,
        deviceScaleFactor: 1
      });
      
      // Override permissions
      const context = this.browser.defaultBrowserContext();
      await context.overridePermissions('https://www.google.com', ['geolocation']);
      
      // Set geolocation (can be overridden per zone)
      // Use config location if available
      let geoLat, geoLon;
      if (this.currentZone) {
        geoLat = this.currentZone.center_latitude;
        geoLon = this.currentZone.center_longitude;
      } else {
        // Use center of configured area (Austin or other location)
        geoLat = (config.googleMaps.bounds.north + config.googleMaps.bounds.south) / 2;
        geoLon = (config.googleMaps.bounds.east + config.googleMaps.bounds.west) / 2;
      }
      
      // Round to 6 decimal places to prevent precision issues
      geoLat = Math.round(geoLat * 1000000) / 1000000;
      geoLon = Math.round(geoLon * 1000000) / 1000000;
      
      await this.page.setGeolocation({
        latitude: geoLat,
        longitude: geoLon,
        accuracy: 100
      });
      
      logger.info(`Geolocation set to: ${geoLat}, ${geoLon}`);
      
      // Inject realistic properties
      await this.page.evaluateOnNewDocument(() => {
        // Remove webdriver property
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined
        });
        
        // Mock plugins
        Object.defineProperty(navigator, 'plugins', {
          get: () => [1, 2, 3, 4, 5]
        });
        
        // Mock languages
        Object.defineProperty(navigator, 'languages', {
          get: () => ['en-US', 'en']
        });
        
        // Override chrome runtime
        window.chrome = {
          runtime: {}
        };
        
        // Mock permissions
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
          parameters.name === 'notifications' ?
            Promise.resolve({ state: Notification.permission }) :
            originalQuery(parameters)
        );
      });
      
      logger.info('Browser initialized with stealth mode');
    } catch (error) {
      logger.error('Failed to initialize browser:', error);
      throw error;
    }
  }

  /**
   * Search businesses - supports both location string and zone coordinates
   * @param {string} query - Search query (e.g., 'restaurants')
   * @param {string|object} location - Location string OR zone object with coordinates
   */
  async searchBusinesses(query, location) {
    try {
      // If zone-based, clear page cookies first to ensure fresh location context
      if (typeof location === 'object' && location.zone_name) {
        const cookies = await this.page.cookies();
        // Delete any Google Maps location cookies
        const locationCookies = cookies.filter(c => c.name.includes('maps') || c.name.includes('loc'));
        if (locationCookies.length > 0) {
          await Promise.all(locationCookies.map(c => this.page.deleteCookie(c)));
          logger.info('Cleared location-related cookies');
        }
      }
      
      logger.info('First visiting Google Maps homepage...');
      
      // Visit Google Maps homepage first (more natural)
      await this.page.goto('https://www.google.com/maps', { 
        waitUntil: 'networkidle2', 
        timeout: 60000 
      });
      
      await delay(3000, 5000);
      
      // Determine search query
      let searchQuery;
      if (typeof location === 'object' && location.zone_name) {
        // Zone-based search - use coordinates for more precise results
        this.currentZone = location;
        const centerLat = location.center_latitude;
        const centerLon = location.center_longitude;
        searchQuery = `${query} near ${centerLat},${centerLon}`;
        logger.info(`Zone-based search: ${location.zone_name} at ${centerLat}, ${centerLon}`);
      } else {
        // Traditional location string search
        searchQuery = `${query} in ${location}`;
        this.currentZone = null;
        logger.info(`Traditional location search: ${searchQuery}`);
      }
      
      logger.info(`Searching for: ${searchQuery}`);
      
      // Force direct URL navigation to bypass cached location data
      logger.warn('Using direct URL to force location');
      let url;
      if (typeof location === 'object' && location.zone_name) {
        // For zone searches, use specific coordinates in the URL
        const lat = location.center_latitude;
        const lon = location.center_longitude;
        // Use specific zoom and coordinates to force map location
        url = `https://www.google.com/maps/search/${encodeURIComponent(query)}/@${lat},${lon},14z/data=!3m1!4b1?entry=ttu`;
        logger.info(`Direct URL for zone ${location.zone_name}: ${url}`);
      } else {
        // Traditional search with location string
        url = `https://www.google.com/maps/search/${encodeURIComponent(searchQuery)}`;
      }
      
      await this.page.goto(url, { 
        waitUntil: 'networkidle2', 
        timeout: 90000 
      });
      
      // Wait for results to load
      logger.info('Waiting for results to load...');
      await delay(8000, 12000); // Longer wait
      
      // Wait for the results panel
      try {
        await this.page.waitForSelector('[role="feed"]', { timeout: 15000 });
        logger.info('Results panel loaded successfully');
      } catch (e) {
        logger.warn('Results panel not found with role=feed, trying alternative selectors');
        try {
          await this.page.waitForSelector('div.m6QErb', { timeout: 10000 });
          logger.info('Found results with alternative selector');
        } catch (e2) {
          logger.warn('Alternative selector also failed, will try to extract anyway');
        }
      }
      
      // Random mouse movements (appear more human)
      await this.page.mouse.move(Math.random() * 1000, Math.random() * 800);
      await delay(500, 1000);
      
      logger.info('Search loaded, ready to extract businesses');
    } catch (error) {
      logger.error('Search failed:', error);
      throw error;
    }
  }

  async scrollResults(maxScrolls = 10) {
    try {
      logger.info('Scrolling through results...');
      
      const scrollableSelector = 'div[role="feed"]';
      await this.page.waitForSelector(scrollableSelector, { timeout: 10000 });
      
      let previousHeight = 0;
      let scrollAttempts = 0;
      
      while (scrollAttempts < maxScrolls) {
        const currentHeight = await this.page.evaluate((selector) => {
          const element = document.querySelector(selector);
          if (element) {
            element.scrollTop = element.scrollHeight;
            return element.scrollHeight;
          }
          return 0;
        }, scrollableSelector);
        
        await delay(config.scraping.delayMin, config.scraping.delayMax);
        
        if (currentHeight === previousHeight) {
          logger.info('Reached end of results');
          break;
        }
        
        previousHeight = currentHeight;
        scrollAttempts++;
        logger.info(`Scroll attempt ${scrollAttempts}/${maxScrolls}`);
      }
      
    } catch (error) {
      logger.warn('Scrolling issue (continuing anyway):', error.message);
    }
  }

  async extractBusinesses() {
    try {
      logger.info('Extracting business data by clicking on each one...');
      
      // Take a screenshot for debugging
      try {
        await this.page.screenshot({ path: 'logs/scraping-debug.png' });
        logger.info('Screenshot saved to logs/scraping-debug.png');
      } catch (e) {
        logger.warn('Could not save screenshot');
      }
      
      // Get the count of businesses in the list with retry
      let businessCount = 0;
      try {
        businessCount = await this.page.evaluate(() => {
          // Try multiple selectors
          let cards = document.querySelectorAll('a.hfpxzc');
          if (cards.length === 0) {
            cards = document.querySelectorAll('div[role="article"]');
          }
          return cards.length;
        });
      } catch (e) {
        logger.warn('Error getting business count, retrying...');
        await delay(2000, 3000);
        try {
          businessCount = await this.page.evaluate(() => {
            let cards = document.querySelectorAll('a.hfpxzc');
            if (cards.length === 0) {
              cards = document.querySelectorAll('div[role="article"]');
            }
            return cards.length;
          });
        } catch (e2) {
          logger.warn('Second attempt also failed, returning empty list');
          businessCount = 0;
        }
      }
      
      logger.info(`Found ${businessCount} businesses in the list`);
      
      if (businessCount === 0) {
        logger.warn('No business cards found in the sidebar!');
        return [];
      }
      
      const businesses = [];
      
      // Click on each business and extract details
      for (let i = 0; i < businessCount; i++) {
        try {
          logger.info(`Processing business ${i + 1}/${businessCount}`);
          
          // Check if page is still valid before clicking
          if (!this.page) {
            logger.warn('Page is null, stopping extraction');
            break;
          }
          
          // Click on the business card at index i with retry
          let clicked = false;
          try {
            clicked = await this.page.evaluate((index) => {
              // Try multiple selectors
              let cards = document.querySelectorAll('a.hfpxzc');
              if (cards.length === 0) {
                cards = document.querySelectorAll('div[role="article"]');
              }
              
              if (cards[index]) {
                cards[index].click();
                return true;
              }
              return false;
            }, i);
          } catch (e) {
            logger.warn(`Error clicking business ${i + 1}, skipping...`);
            clicked = false;
          }
          
          if (!clicked) {
            logger.warn(`Could not click business at index ${i}`);
            continue;
          }
          
          // Wait for details panel to load
          await delay(3000, 5000);
          
          // Extract detailed information from the opened business panel
          const business = await this.page.evaluate(() => {
            try {
              // Name
              let name = null;
              const nameSelectors = [
                'h1.DUwDvf',
                'h1.fontHeadlineLarge',
                'h1[class*="DUwDvf"]'
              ];
              
              for (const selector of nameSelectors) {
                const el = document.querySelector(selector);
                if (el && el.innerText) {
                  name = el.innerText.trim();
                  break;
                }
              }
              
              if (!name) return null;
              
              // Category
              let category = 'Unknown';
              const categoryEl = document.querySelector('button[jsaction*="category"]');
              if (categoryEl) {
                category = categoryEl.innerText.trim();
              }
              
              // Rating
              let rating = null;
              const ratingEl = document.querySelector('div.F7nice span[aria-hidden="true"]');
              if (ratingEl) {
                const ratingText = ratingEl.innerText;
                const match = ratingText.match(/([\d.]+)/);
                if (match) rating = parseFloat(match[1]);
              }
              
              // Review count
              let reviewCount = 0;
              const reviewEl = document.querySelector('div.F7nice span[aria-label]');
              if (reviewEl) {
                const ariaLabel = reviewEl.getAttribute('aria-label');
                const match = ariaLabel.match(/([\d,]+)/);
                if (match) {
                  reviewCount = parseInt(match[1].replace(/,/g, ''));
                }
              }
              
              // Address
              let address = null;
              const addressButtons = document.querySelectorAll('button[data-item-id^="address"]');
              for (const btn of addressButtons) {
                const ariaLabel = btn.getAttribute('aria-label');
                if (ariaLabel && ariaLabel.includes('Address:')) {
                  address = ariaLabel.replace('Address:', '').trim();
                  break;
                }
              }
              
              // Phone
              let phone = null;
              const phoneButtons = document.querySelectorAll('button[data-item-id*="phone"]');
              for (const btn of phoneButtons) {
                const ariaLabel = btn.getAttribute('aria-label');
                if (ariaLabel) {
                  // Extract phone number
                  const phoneMatch = ariaLabel.match(/([+\d\s()-]+)/);
                  if (phoneMatch) {
                    phone = phoneMatch[1].trim();
                    break;
                  }
                }
              }
              
              // Website
              let hasWebsite = false;
              let websiteUrl = null;
              const websiteButtons = document.querySelectorAll('a[data-item-id="authority"]');
              if (websiteButtons.length > 0) {
                hasWebsite = true;
                websiteUrl = websiteButtons[0].href;
              }
              
              // Email - look for email links or extract from contact buttons
              let email = null;
              const emailButtons = document.querySelectorAll('a[data-item-id*="email"], a[href^="mailto:"]');
              if (emailButtons.length > 0) {
                const href = emailButtons[0].href;
                if (href.startsWith('mailto:')) {
                  email = href.replace('mailto:', '').split('?')[0];
                }
              }
              
              // Also check contact info buttons for email
              if (!email) {
                const allButtons = document.querySelectorAll('button[data-item-id], a[data-item-id]');
                for (const btn of allButtons) {
                  const ariaLabel = btn.getAttribute('aria-label') || '';
                  if (ariaLabel.includes('Email') || ariaLabel.includes('email')) {
                    const emailMatch = ariaLabel.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
                    if (emailMatch) {
                      email = emailMatch[1];
                      break;
                    }
                  }
                }
              }
              
              return {
                name,
                category,
                rating,
                reviewCount,
                address: address || 'Not available',
                phone,
                email,
                hasWebsite,
                website: websiteUrl
              };
              
            } catch (err) {
              console.error('Error extracting business details:', err);
              return null;
            }
          });
          
          if (business) {
            // Add zone information if available
            if (this.currentZone) {
              business.zone_id = this.currentZone.id;
              business.zone_name = this.currentZone.zone_name;
            }
            businesses.push(business);
            logger.info(`✓ Extracted: ${business.name}`);
          } else {
            logger.warn(`Failed to extract data for business ${i + 1}`);
          }
          
          // Small delay before next business
          await delay(1000, 2000);
          
        } catch (error) {
          logger.warn(`Error processing business ${i + 1}:`, error.message);
          continue;
        }
      }
      
      logger.info(`Successfully extracted ${businesses.length} out of ${businessCount} businesses${this.currentZone ? ` from zone ${this.currentZone.zone_name}` : ''}`);
      
      if (businesses.length === 0) {
        logger.warn('No businesses extracted. Saving page HTML for debugging...');
        const html = await this.page.content();
        const fs = await import('fs');
        fs.default.writeFileSync('logs/page-content.html', html);
        logger.info('Page HTML saved to logs/page-content.html');
      }
      
      // Return metadata about extraction
      return {
        businesses,
        zone: this.currentZone || null,
        extractionCount: businesses.length,
        timestamp: new Date()
      };
      
    } catch (error) {
      logger.error('Failed to extract businesses:', error);
      return [];
    }
  }

  async getBusinessDetails(businessName) {
    try {
      // Click on business to get details
      const clicked = await this.page.evaluate((name) => {
        const cards = document.querySelectorAll('div[role="article"]');
        for (const card of cards) {
          const nameElement = card.querySelector('div.fontHeadlineSmall');
          if (nameElement && nameElement.innerText.includes(name)) {
            card.click();
            return true;
          }
        }
        return false;
      }, businessName);
      
      if (!clicked) return null;
      
      await delay(2000, 3000);
      
      // Extract detailed information
      const details = await this.page.evaluate(() => {
        const getTextByLabel = (label) => {
          const buttons = document.querySelectorAll('button[data-item-id]');
          for (const btn of buttons) {
            if (btn.getAttribute('aria-label')?.includes(label)) {
              return btn.getAttribute('aria-label');
            }
          }
          return null;
        };
        
        const phone = getTextByLabel('Phone');
        const website = getTextByLabel('Website');
        const address = getTextByLabel('Address');
        
        return {
          phone: phone ? phone.replace(/[^\d+]/g, '') : null,
          hasWebsite: website ? true : false,
          address: address || null
        };
      });
      
      return details;
      
    } catch (error) {
      logger.warn(`Failed to get details for ${businessName}:`, error.message);
      return null;
    }
  }

  /**
   * Scrape businesses
   * @param {number} limit - Max businesses to scrape
   * @param {object} zone - Optional zone object for zone-based scraping
   * @returns {array|object} Array of businesses or object with metadata
   */
  async scrape(limit = 100, zone = null) {
    try {
      await this.initialize();
      
      // Use zone if provided, otherwise use traditional location
      const searchLocation = zone || config.googleMaps.location;
      
      await this.searchBusinesses(
        config.googleMaps.searchQuery,
        searchLocation
      );
      
      // Wait a bit more before scrolling
      await delay(3000, 5000);
      
      await this.scrollResults(5); // Fewer scrolls for testing
      
      // Wait after scrolling
      await delay(2000, 3000);
      
      let result = await this.extractBusinesses();
      
      // Handle both old (array) and new (object) return formats
      let businesses = Array.isArray(result) ? result : result.businesses || [];
      
      if (businesses.length === 0) {
        logger.warn('No businesses found. Saving page HTML for debugging...');
        const html = await this.page.content();
        const fs = await import('fs');
        fs.default.writeFileSync('logs/page-content.html', html);
        logger.info('Page HTML saved to logs/page-content.html');
      }
      
      businesses = businesses.slice(0, limit);
      
      logger.info(`Returning ${businesses.length} businesses`);
      
      // Return in same format as extractBusinesses for consistency
      return zone ? { businesses, zone, extractionCount: businesses.length } : businesses;
      
    } catch (error) {
      logger.error('Scraping failed:', error);
      throw error;
    } finally {
      await this.close();
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      logger.info('Browser closed');
    }
    
    // Clean up temporary browser directory
    if (this.userDataDir) {
      try {
        const fs = await import('fs');
        const path = await import('path');
        if (fs.default.existsSync(this.userDataDir)) {
          // Remove directory recursively (Windows compatible)
          await fs.promises.rm(this.userDataDir, { recursive: true, force: true });
          logger.info(`Cleaned up temporary browser directory: ${this.userDataDir}`);
        }
      } catch (error) {
        logger.warn(`Failed to clean up temporary directory ${this.userDataDir}:`, error.message);
      }
    }
  }
}

export default GoogleMapsScraper;
