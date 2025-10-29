import logger from '../utils/logger.js';
import config from '../config/config.js';
import EmailService from '../integrations/emailService.js';
import {
  getQualifiedLeads,
  getBusinessesForFollowUp,
  updateLastContacted,
  insertOutreachHistory,
  updateMetrics,
  getTodayMetrics
} from '../utils/database.js';

class OutreachManager {
  constructor() {
    this.emailService = new EmailService();
  }

  async runDailyCampaign() {
    try {
      logger.info('Starting daily email campaign...');

      // Check how many emails sent today
      const todayMetrics = await getTodayMetrics();
      const remaining = config.email.maxDailyEmails - (todayMetrics?.emails_sent || 0);

      if (remaining <= 0) {
        logger.info('Daily email limit reached. Skipping campaign.');
        return;
      }

      logger.info(`Can send ${remaining} more emails today`);

      // Get qualified leads
      const leads = await getQualifiedLeads(remaining);
      
      if (leads.length === 0) {
        logger.info('No qualified leads available for outreach');
        return;
      }

      logger.info(`Found ${leads.length} qualified leads for outreach`);

      // Send emails
      const results = await this.emailService.sendBatch(leads, 'initial');

      // Update database
      const today = new Date().toISOString().split('T')[0];
      let sentCount = 0;

      results.forEach((result, index) => {
        if (result.success) {
          const business = leads[index];
          updateLastContacted(business.id);
          insertOutreachHistory(business.id, 'initial', 'Initial outreach email');
          sentCount++;
        }
      });

      // Update metrics
      updateMetrics(today, 'emails_sent', sentCount);

      logger.info(`Daily campaign completed. Sent ${sentCount} emails.`);
      
      return { sent: sentCount, failed: results.length - sentCount };
      
    } catch (error) {
      logger.error('Daily campaign failed:', error);
      throw error;
    }
  }

  async runFollowUpCampaign() {
    try {
      logger.info('Starting follow-up campaign...');

      const todayMetrics = await getTodayMetrics();
      const remaining = config.email.maxDailyEmails - (todayMetrics?.emails_sent || 0);

      if (remaining <= 0) {
        logger.info('Daily email limit reached. Skipping follow-up.');
        return;
      }

      // Get businesses for first follow-up (3 days after initial contact)
      const followUp1 = await getBusinessesForFollowUp(3, 1);
      
      // Get businesses for second follow-up (7 days after initial contact)
      const followUp2 = await getBusinessesForFollowUp(7, 2);

      logger.info(`Follow-up candidates: ${followUp1.length} (1st), ${followUp2.length} (2nd)`);

      let sentCount = 0;
      const today = new Date().toISOString().split('T')[0];

      // Send first follow-ups
      if (followUp1.length > 0 && sentCount < remaining) {
        const toSend = followUp1.slice(0, remaining - sentCount);
        const results = await this.emailService.sendBatch(toSend, 'followup1');
        
        results.forEach((result, index) => {
          if (result.success) {
            const business = toSend[index];
            updateLastContacted(business.id);
            insertOutreachHistory(business.id, 'followup1', 'First follow-up');
            sentCount++;
          }
        });
      }

      // Send second follow-ups
      if (followUp2.length > 0 && sentCount < remaining) {
        const toSend = followUp2.slice(0, remaining - sentCount);
        const results = await this.emailService.sendBatch(toSend, 'followup2');
        
        results.forEach((result, index) => {
          if (result.success) {
            const business = toSend[index];
            updateLastContacted(business.id);
            insertOutreachHistory(business.id, 'followup2', 'Second follow-up');
            sentCount++;
          }
        });
      }

      // Update metrics
      if (sentCount > 0) {
        updateMetrics(today, 'emails_sent', sentCount);
      }

      logger.info(`Follow-up campaign completed. Sent ${sentCount} emails.`);
      
      return { sent: sentCount };
      
    } catch (error) {
      logger.error('Follow-up campaign failed:', error);
      throw error;
    }
  }

  async runCombinedCampaign() {
    // Run initial campaign first
    const initialResults = await this.runDailyCampaign();
    
    // Then run follow-ups if quota allows
    const followUpResults = await this.runFollowUpCampaign();
    
    return {
      initial: initialResults,
      followUp: followUpResults
    };
  }
}

export default OutreachManager;
