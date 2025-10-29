import logger from '../utils/logger.js';
import { 
  calculatePriorityScore, 
  isChainBusiness, 
  sanitizeBusinessName,
  normalizePhone 
} from '../utils/validator.js';
import { insertBusiness, updateMetrics } from '../utils/database.js';

class BusinessProcessor {
  constructor() {
    this.processedCount = 0;
    this.qualifiedCount = 0;
  }

  filterBusiness(business) {
    // Filter out chain businesses
    if (isChainBusiness(business.name)) {
      logger.debug(`Filtered out chain business: ${business.name}`);
      return false;
    }

    // Require minimum information
    if (!business.name || !business.address) {
      logger.debug(`Filtered out business with missing info: ${business.name}`);
      return false;
    }

    // Filter out businesses with website (we only target those without websites)
    if (business.hasWebsite) {
      logger.debug(`Filtered out business with website: ${business.name}`);
      return false;
    }

    return true;
  }

  enrichBusiness(business) {
    // Sanitize and normalize data
    business.name = sanitizeBusinessName(business.name);
    business.phone = normalizePhone(business.phone);
    
    // Calculate priority score
    business.priorityScore = calculatePriorityScore(business);
    
    return business;
  }

  async processBusiness(business) {
    try {
      logger.info(`[DEBUG] Processing: ${business.name}`);
      
      // Filter business
      if (!this.filterBusiness(business)) {
        logger.info(`[DEBUG] Filtered out: ${business.name}`);
        return false;
      }

      logger.info(`[DEBUG] Passed filter: ${business.name}`);
      
      // Enrich business data
      const enrichedBusiness = this.enrichBusiness(business);

      logger.info(`[DEBUG] Inserting: ${enrichedBusiness.name}`);
      
      // Insert into database
      const result = await insertBusiness(enrichedBusiness);
      
      logger.info(`[DEBUG] Insert result for ${enrichedBusiness.name}: changes=${result.changes}`);
      
      if (result.changes > 0) {
        this.qualifiedCount++;
        logger.info(`Qualified lead: ${enrichedBusiness.name} (Score: ${enrichedBusiness.priorityScore})`);
        return true;
      }

      return false;
    } catch (error) {
      logger.error(`Error processing business ${business.name}:`, error);
      return false;
    }
  }

  async processBatch(businesses) {
    logger.info(`Processing ${businesses.length} businesses...`);
    
    this.processedCount = 0;
    this.qualifiedCount = 0;

    for (const business of businesses) {
      await this.processBusiness(business);
      this.processedCount++;
    }

    // Update metrics
    const today = new Date().toISOString().split('T')[0];
    updateMetrics(today, 'businesses_scraped', this.processedCount);
    updateMetrics(today, 'leads_qualified', this.qualifiedCount);

    logger.info(`Processed ${this.processedCount} businesses, ${this.qualifiedCount} qualified leads`);
    
    return {
      processed: this.processedCount,
      qualified: this.qualifiedCount
    };
  }
}

export default BusinessProcessor;
