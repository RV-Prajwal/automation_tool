import mysql from 'mysql2/promise';
import logger from './logger.js';
import config from '../config/config.js';

// Create connection pool
let pool = null;

// Initialize MySQL connection pool
async function initDB() {
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
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0
    });
    
    // Test connection
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    
    logger.info('MySQL connection pool created successfully');
    return pool;
  } catch (error) {
    logger.error('Failed to create MySQL connection pool:', error);
    throw error;
  }
}

// Initialize database schema
const initDatabase = async () => {
  try {
    await initDB();
    
    const connection = await pool.getConnection();
    
    try {
      // Create businesses table
      await connection.query(`
        CREATE TABLE IF NOT EXISTS businesses (
          id INT PRIMARY KEY AUTO_INCREMENT,
          name VARCHAR(255) NOT NULL,
          category VARCHAR(255),
          address TEXT,
          phone VARCHAR(50),
          email VARCHAR(255),
          has_website TINYINT(1) DEFAULT 0,
          rating DECIMAL(3,2),
          review_count INT DEFAULT 0,
          priority_score INT DEFAULT 0,
          status VARCHAR(50) DEFAULT 'new',
          notes TEXT,
          latitude DECIMAL(10,8),
          longitude DECIMAL(11,8),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          last_contacted_at TIMESTAMP NULL,
          UNIQUE KEY unique_business (name, address(255)),
          INDEX idx_status (status),
          INDEX idx_priority (priority_score DESC),
          INDEX idx_website (has_website),
          INDEX idx_created (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      
      // Create outreach_history table
      await connection.query(`
        CREATE TABLE IF NOT EXISTS outreach_history (
          id INT PRIMARY KEY AUTO_INCREMENT,
          business_id INT NOT NULL,
          email_type VARCHAR(100) NOT NULL,
          email_subject VARCHAR(255),
          email_sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          email_opened TINYINT(1) DEFAULT 0,
          email_clicked TINYINT(1) DEFAULT 0,
          response_received TINYINT(1) DEFAULT 0,
          response_text TEXT,
          response_at TIMESTAMP NULL,
          INDEX idx_business (business_id),
          INDEX idx_sent_at (email_sent_at),
          FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      
      // Create unsubscribes table
      await connection.query(`
        CREATE TABLE IF NOT EXISTS unsubscribes (
          id INT PRIMARY KEY AUTO_INCREMENT,
          business_id INT NOT NULL,
          email VARCHAR(255),
          unsubscribed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_business (business_id),
          FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      
      // Create metrics table
      await connection.query(`
        CREATE TABLE IF NOT EXISTS metrics (
          id INT PRIMARY KEY AUTO_INCREMENT,
          date DATE NOT NULL UNIQUE,
          businesses_scraped INT DEFAULT 0,
          leads_qualified INT DEFAULT 0,
          emails_sent INT DEFAULT 0,
          responses_received INT DEFAULT 0,
          conversions INT DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_date (date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      
      logger.info('Database schema initialized successfully');
    } finally {
      connection.release();
    }
  } catch (error) {
    logger.error('Database initialization failed:', error);
    throw error;
  }
};

// Business operations
export const insertBusiness = async (business) => {
  try {
    if (!pool) await initDB();
    
    const [result] = await pool.query(
      `INSERT IGNORE INTO businesses (
        name, category, address, phone, email, has_website, rating, review_count, 
        priority_score, latitude, longitude
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        business.name,
        business.category,
        business.address,
        business.phone,
        business.email,
        business.hasWebsite ? 1 : 0,
        business.rating,
        business.reviewCount || 0,
        business.priorityScore || 0,
        business.latitude,
        business.longitude
      ]
    );
    
    return { changes: result.affectedRows };
  } catch (error) {
    logger.error('Insert business error:', error.message);
    return { changes: 0 };
  }
};

export const getBusinessById = async (id) => {
  try {
    if (!pool) await initDB();
    
    const [rows] = await pool.query('SELECT * FROM businesses WHERE id = ?', [id]);
    return rows[0] || null;
  } catch (error) {
    logger.error('Get business by ID error:', error);
    return null;
  }
};

export const getQualifiedLeads = async (limit = 50) => {
  try {
    if (!pool) await initDB();
    
    const [rows] = await pool.query(
      `SELECT * FROM businesses 
      WHERE has_website = 0 
        AND status = 'new'
        AND id NOT IN (SELECT business_id FROM unsubscribes)
      ORDER BY priority_score DESC, created_at ASC
      LIMIT ?`,
      [limit]
    );
    
    return rows;
  } catch (error) {
    logger.error('Get qualified leads error:', error);
    return [];
  }
};

export const getSmsQualifiedLeads = async () => {
  try {
    if (!pool) await initDB();
    
    // Return all qualified leads (businesses without websites), regardless of status or phone availability
    const [rows] = await pool.query(
      `SELECT id, name, phone, category, address FROM businesses 
      WHERE has_website = 0 
        AND id NOT IN (SELECT business_id FROM unsubscribes)
      ORDER BY priority_score DESC, created_at ASC`
    );
    
    return rows;
  } catch (error) {
    logger.error('Get SMS qualified leads error:', error);
    return [];
  }
};

export const getBusinessesForFollowUp = async (daysSinceLastContact, followUpNumber) => {
  try {
    if (!pool) await initDB();
    
    const [rows] = await pool.query(
      `SELECT b.* FROM businesses b
      LEFT JOIN outreach_history oh ON b.id = oh.business_id
      WHERE b.status = 'contacted'
        AND b.has_website = 0
        AND b.id NOT IN (SELECT business_id FROM unsubscribes)
        AND DATEDIFF(NOW(), b.last_contacted_at) >= ?
        AND (SELECT COUNT(*) FROM outreach_history WHERE business_id = b.id) = ?
      ORDER BY b.priority_score DESC`,
      [daysSinceLastContact, followUpNumber]
    );
    
    return rows;
  } catch (error) {
    logger.error('Get businesses for follow up error:', error);
    return [];
  }
};

export const updateBusinessStatus = async (id, status) => {
  try {
    if (!pool) await initDB();
    
    const [result] = await pool.query(
      `UPDATE businesses 
      SET status = ?, updated_at = NOW() 
      WHERE id = ?`,
      [status, id]
    );
    
    return { changes: result.affectedRows };
  } catch (error) {
    logger.error('Update business status error:', error);
    return { changes: 0 };
  }
};

export const updateLastContacted = async (id) => {
  try {
    if (!pool) await initDB();
    
    const [result] = await pool.query(
      `UPDATE businesses 
      SET last_contacted_at = NOW(), 
          status = 'contacted',
          updated_at = NOW() 
      WHERE id = ?`,
      [id]
    );
    
    return { changes: result.affectedRows };
  } catch (error) {
    logger.error('Update last contacted error:', error);
    return { changes: 0 };
  }
};

// Outreach history operations
export const insertOutreachHistory = async (businessId, emailType, subject) => {
  try {
    if (!pool) await initDB();
    
    const [result] = await pool.query(
      `INSERT INTO outreach_history (business_id, email_type, email_subject)
      VALUES (?, ?, ?)`,
      [businessId, emailType, subject]
    );
    
    return { changes: result.affectedRows };
  } catch (error) {
    logger.error('Insert outreach history error:', error);
    return { changes: 0 };
  }
};

export const getOutreachHistory = async (businessId) => {
  try {
    if (!pool) await initDB();
    
    const [rows] = await pool.query(
      `SELECT * FROM outreach_history 
      WHERE business_id = ? 
      ORDER BY email_sent_at DESC`,
      [businessId]
    );
    
    return rows;
  } catch (error) {
    logger.error('Get outreach history error:', error);
    return [];
  }
};

// Unsubscribe operations
export const addUnsubscribe = async (businessId, email) => {
  try {
    if (!pool) await initDB();
    
    const [result] = await pool.query(
      `INSERT IGNORE INTO unsubscribes (business_id, email)
      VALUES (?, ?)`,
      [businessId, email]
    );
    
    return { changes: result.affectedRows };
  } catch (error) {
    logger.error('Add unsubscribe error:', error);
    return { changes: 0 };
  }
};

export const isUnsubscribed = async (businessId) => {
  try {
    if (!pool) await initDB();
    
    const [rows] = await pool.query(
      `SELECT COUNT(*) as count FROM unsubscribes WHERE business_id = ?`,
      [businessId]
    );
    
    return rows[0].count > 0;
  } catch (error) {
    logger.error('Check unsubscribe error:', error);
    return false;
  }
};

// Metrics operations
export const updateMetrics = async (date, field, increment = 1) => {
  try {
    if (!pool) await initDB();
    
    await pool.query(
      `INSERT INTO metrics (date, ${field})
      VALUES (?, ?)
      ON DUPLICATE KEY UPDATE ${field} = ${field} + ?`,
      [date, increment, increment]
    );
  } catch (error) {
    logger.error('Update metrics error:', error);
  }
};

export const getMetrics = async (startDate, endDate) => {
  try {
    if (!pool) await initDB();
    
    const [rows] = await pool.query(
      `SELECT * FROM metrics 
      WHERE date BETWEEN ? AND ?
      ORDER BY date DESC`,
      [startDate, endDate]
    );
    
    return rows;
  } catch (error) {
    logger.error('Get metrics error:', error);
    return [];
  }
};

export const getTodayMetrics = async () => {
  try {
    if (!pool) await initDB();
    
    const today = new Date().toISOString().split('T')[0];
    const [rows] = await pool.query('SELECT * FROM metrics WHERE date = ?', [today]);
    
    return rows[0] || {
      businesses_scraped: 0,
      leads_qualified: 0,
      emails_sent: 0,
      responses_received: 0,
      conversions: 0
    };
  } catch (error) {
    logger.error('Get today metrics error:', error);
    return {
      businesses_scraped: 0,
      leads_qualified: 0,
      emails_sent: 0,
      responses_received: 0,
      conversions: 0
    };
  }
};

// Statistics
export const getStats = async () => {
  try {
    if (!pool) await initDB();
    
    const [rows] = await pool.query(`
      SELECT 
        COUNT(*) as total_businesses,
        SUM(CASE WHEN has_website = 0 THEN 1 ELSE 0 END) as without_website,
        SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) as new_leads,
        SUM(CASE WHEN status = 'contacted' THEN 1 ELSE 0 END) as contacted,
        SUM(CASE WHEN status = 'converted' THEN 1 ELSE 0 END) as converted,
        (SELECT COUNT(*) FROM outreach_history WHERE DATE(email_sent_at) = CURDATE()) as emails_sent_today
      FROM businesses
    `);
    
    return rows[0] || {};
  } catch (error) {
    logger.error('Get stats error:', error);
    return {};
  }
};

// Close pool on exit
export const closePool = async () => {
  if (pool) {
    await pool.end();
    logger.info('MySQL connection pool closed');
  }
};

// Initialize database on import and export readiness promise
export const dbReady = initDatabase();

// Cleanup on exit
process.on('exit', () => {
  if (pool) {
    pool.end();
  }
});

process.on('SIGINT', async () => {
  await closePool();
  process.exit();
});

export default pool;
