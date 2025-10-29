import { google } from 'googleapis';
import fs from 'fs';
import logger from '../utils/logger.js';
import config from '../config/config.js';
import db from '../utils/database.js';

class SheetsManager {
  constructor() {
    this.sheets = null;
    this.auth = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      // Check if credentials file exists
      if (!fs.existsSync(config.sheets.credentialsPath)) {
        logger.warn('Google Sheets credentials not found. Skipping sheets integration.');
        return;
      }

      // Load credentials
      const credentials = JSON.parse(fs.readFileSync(config.sheets.credentialsPath, 'utf8'));
      
      // Create auth client
      this.auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });

      // Initialize sheets API
      this.sheets = google.sheets({ version: 'v4', auth: this.auth });
      this.initialized = true;
      
      logger.info('Google Sheets integration initialized');
    } catch (error) {
      logger.error('Failed to initialize Google Sheets:', error);
      throw error;
    }
  }

  async syncLeads() {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.sheets) {
      logger.warn('Sheets not initialized, skipping sync');
      return;
    }

    try {
      logger.info('Syncing leads to Google Sheets...');

      // Get all businesses from database
      const stmt = db.prepare(`
        SELECT id, name, category, address, phone, email, rating, review_count, 
               priority_score, status, last_contacted_at, created_at
        FROM businesses
        ORDER BY priority_score DESC, created_at DESC
      `);
      
      const businesses = [];
      while (stmt.step()) {
        businesses.push(stmt.getAsObject());
      }
      stmt.free();

      // Prepare data for sheets
      const headers = [
        'ID', 'Business Name', 'Category', 'Address', 'Phone', 'Email',
        'Rating', 'Reviews', 'Priority Score', 'Status', 'Last Contacted', 'Created At'
      ];

      const rows = businesses.map(b => [
        b.id,
        b.name,
        b.category || '',
        b.address || '',
        b.phone || '',
        b.email || '',
        b.rating || '',
        b.review_count || 0,
        b.priority_score || 0,
        b.status || 'new',
        b.last_contacted_at || '',
        b.created_at || ''
      ]);

      const values = [headers, ...rows];

      // Clear and update sheet
      await this.sheets.spreadsheets.values.clear({
        spreadsheetId: config.sheets.sheetId,
        range: 'Leads!A1:Z'
      });

      await this.sheets.spreadsheets.values.update({
        spreadsheetId: config.sheets.sheetId,
        range: 'Leads!A1',
        valueInputOption: 'RAW',
        resource: { values }
      });

      logger.info(`Synced ${businesses.length} leads to Google Sheets`);
    } catch (error) {
      logger.error('Failed to sync to Google Sheets:', error);
    }
  }

  async syncMetrics() {
    if (!this.initialized || !this.sheets) return;

    try {
      logger.info('Syncing metrics to Google Sheets...');

      // Get metrics for last 30 days
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const stmt = db.prepare(`
        SELECT date, businesses_scraped, leads_qualified, emails_sent, 
               responses_received, conversions
        FROM metrics
        WHERE date BETWEEN ? AND ?
        ORDER BY date DESC
      `);
      stmt.bind([startDate, endDate]);
      
      const metrics = [];
      while (stmt.step()) {
        metrics.push(stmt.getAsObject());
      }
      stmt.free();

      const headers = [
        'Date', 'Scraped', 'Qualified', 'Emails Sent', 'Responses', 'Conversions'
      ];

      const rows = metrics.map(m => [
        m.date,
        m.businesses_scraped || 0,
        m.leads_qualified || 0,
        m.emails_sent || 0,
        m.responses_received || 0,
        m.conversions || 0
      ]);

      const values = [headers, ...rows];

      // Update metrics sheet
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: config.sheets.sheetId,
        range: 'Metrics!A1',
        valueInputOption: 'RAW',
        resource: { values }
      });

      logger.info(`Synced ${metrics.length} days of metrics`);
    } catch (error) {
      logger.error('Failed to sync metrics:', error);
    }
  }

  async fullSync() {
    await this.syncLeads();
    await this.syncMetrics();
  }
}

export default SheetsManager;
