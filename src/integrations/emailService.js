import nodemailer from 'nodemailer';
import logger from '../utils/logger.js';
import config from '../config/config.js';
import { getTemplate, getFollowUpTemplate } from '../config/templates.js';

class EmailService {
  constructor() {
    this.transporter = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: config.email.user,
          pass: config.email.password
        }
      });

      // Verify connection
      await this.transporter.verify();
      this.initialized = true;
      logger.info('Email service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize email service:', error);
      throw error;
    }
  }

  generateUnsubscribeLink(businessId) {
    // In production, this would be a real endpoint
    return `mailto:${config.email.user}?subject=Unsubscribe&body=Business ID: ${businessId}`;
  }

  personalizeEmail(template, business) {
    let { subject, body } = template;

    const replacements = {
      '{businessName}': business.name,
      '{location}': config.googleMaps.location,
      '{price}': config.business.price.toLocaleString('en-IN'),
      '{senderName}': config.email.fromName,
      '{phone}': config.business.phone || '',
      '{unsubscribeLink}': this.generateUnsubscribeLink(business.id)
    };

    // Replace all placeholders
    Object.entries(replacements).forEach(([placeholder, value]) => {
      subject = subject.replace(new RegExp(placeholder, 'g'), value);
      body = body.replace(new RegExp(placeholder, 'g'), value);
    });

    return { subject, body };
  }

  async sendEmail(business, emailType = 'initial') {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      let template;
      
      if (emailType === 'initial') {
        template = getTemplate(business.category);
      } else if (emailType === 'followup1') {
        template = getFollowUpTemplate(1);
      } else if (emailType === 'followup2') {
        template = getFollowUpTemplate(2);
      } else {
        throw new Error(`Unknown email type: ${emailType}`);
      }

      const { subject, body } = this.personalizeEmail(template, business);

      // Prepare email options
      const mailOptions = {
        from: `${config.email.fromName} <${config.email.user}>`,
        to: business.email || business.phone, // Phone can be used for SMS gateways
        subject: subject,
        text: body,
        html: body.replace(/\n/g, '<br>') // Simple HTML conversion
      };

      // Send email
      const info = await this.transporter.sendMail(mailOptions);
      
      logger.info(`Email sent to ${business.name}: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
      
    } catch (error) {
      logger.error(`Failed to send email to ${business.name}:`, error);
      return { success: false, error: error.message };
    }
  }

  async sendBatch(businesses, emailType = 'initial', delayBetween = 5000) {
    logger.info(`Sending ${emailType} emails to ${businesses.length} businesses...`);
    
    const results = [];
    
    for (const business of businesses) {
      const result = await this.sendEmail(business, emailType);
      results.push({ business: business.id, ...result });
      
      // Delay between emails to avoid spam flags
      if (businesses.indexOf(business) < businesses.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delayBetween));
      }
    }

    const successCount = results.filter(r => r.success).length;
    logger.info(`Sent ${successCount}/${businesses.length} emails successfully`);
    
    return results;
  }
}

export default EmailService;
