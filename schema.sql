-- Business Scraper & Outreach Automation Database Schema
-- MySQL Database

CREATE DATABASE IF NOT EXISTS business_scraper CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE business_scraper;

-- Scraped zones table (for location-based scraping tracking)
CREATE TABLE IF NOT EXISTS scraped_zones (
  id INT PRIMARY KEY AUTO_INCREMENT,
  zone_name VARCHAR(100) NOT NULL,
  zone_type ENUM('grid', 'locality') DEFAULT 'grid',
  latitude_min DECIMAL(10,8) NOT NULL,
  latitude_max DECIMAL(10,8) NOT NULL,
  longitude_min DECIMAL(11,8) NOT NULL,
  longitude_max DECIMAL(11,8) NOT NULL,
  center_latitude DECIMAL(10,8),
  center_longitude DECIMAL(11,8),
  last_scraped_at TIMESTAMP NULL,
  business_count INT DEFAULT 0,
  status ENUM('pending', 'in_progress', 'completed') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_zone_name (zone_name),
  INDEX idx_status (status),
  INDEX idx_last_scraped (last_scraped_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Businesses table
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
  zone_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_contacted_at TIMESTAMP NULL,
  UNIQUE KEY unique_business (name, address(255)),
  INDEX idx_status (status),
  INDEX idx_priority (priority_score DESC),
  INDEX idx_website (has_website),
  INDEX idx_created (created_at),
  INDEX idx_zone (zone_id),
  FOREIGN KEY (zone_id) REFERENCES scraped_zones(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Outreach history table
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Unsubscribes table
CREATE TABLE IF NOT EXISTS unsubscribes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  business_id INT NOT NULL,
  email VARCHAR(255),
  unsubscribed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_business (business_id),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Metrics table
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
