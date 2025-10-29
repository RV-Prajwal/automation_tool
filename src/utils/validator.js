import logger from './logger.js';

export const isValidEmail = (email) => {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const isValidPhone = (phone) => {
  if (!phone) return false;
  // Indian phone number validation
  const phoneRegex = /^[\+]?[0-9]{10,13}$/;
  return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
};

export const normalizePhone = (phone) => {
  if (!phone) return null;
  // Remove spaces, dashes, parentheses
  return phone.replace(/[\s\-\(\)]/g, '');
};

export const isChainBusiness = (name) => {
  const chainKeywords = [
    'mcdonalds', "mcdonald's", 'kfc', 'subway', 'dominos', "domino's",
    'pizza hut', 'starbucks', 'burger king', 'taco bell',
    'walmart', 'target', 'costco', 'cvs', 'walgreens'
  ];
  
  const lowerName = name.toLowerCase();
  return chainKeywords.some(keyword => lowerName.includes(keyword));
};

export const hasWebsiteIndicators = (text) => {
  if (!text) return false;
  
  const websiteIndicators = [
    'http://', 'https://', 'www.', '.com', '.in', '.org', '.net',
    'website', 'site', 'online'
  ];
  
  const lowerText = text.toLowerCase();
  return websiteIndicators.some(indicator => lowerText.includes(indicator));
};

export const calculatePriorityScore = (business) => {
  let score = 0;
  
  // Rating score (0-20 points)
  if (business.rating >= 4.5) score += 20;
  else if (business.rating >= 4.0) score += 15;
  else if (business.rating >= 3.5) score += 10;
  else if (business.rating >= 3.0) score += 5;
  
  // Review count score (0-15 points)
  if (business.reviewCount > 100) score += 15;
  else if (business.reviewCount > 50) score += 12;
  else if (business.reviewCount > 20) score += 10;
  else if (business.reviewCount > 10) score += 7;
  else if (business.reviewCount > 0) score += 5;
  
  // Business category score (0-15 points)
  const category = business.category?.toLowerCase() || '';
  if (category.includes('restaurant') || category.includes('cafe') || category.includes('food')) {
    score += 15;
  } else if (category.includes('retail') || category.includes('shop') || category.includes('store')) {
    score += 13;
  } else if (category.includes('service') || category.includes('repair')) {
    score += 12;
  } else {
    score += 10;
  }
  
  // No website bonus (30 points)
  if (!business.hasWebsite) {
    score += 30;
  }
  
  // Has phone number (20 points)
  if (business.phone && isValidPhone(business.phone)) {
    score += 20;
  }
  
  return score;
};

export const sanitizeBusinessName = (name) => {
  if (!name) return null;
  // Remove extra spaces, special characters
  return name.trim().replace(/\s+/g, ' ');
};

export const extractEmailFromText = (text) => {
  if (!text) return null;
  const emailRegex = /[^\s@]+@[^\s@]+\.[^\s@]+/;
  const match = text.match(emailRegex);
  return match ? match[0] : null;
};

export const delay = (min, max) => {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, ms));
};

export const retryOperation = async (operation, maxRetries = 3, delayMs = 1000) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      logger.warn(`Retry ${i + 1}/${maxRetries} failed:`, error.message);
      if (i === maxRetries - 1) throw error;
      await delay(delayMs * (i + 1), delayMs * (i + 2));
    }
  }
};

export const getRandomUserAgent = () => {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0'
  ];
  
  return userAgents[Math.floor(Math.random() * userAgents.length)];
};

export default {
  isValidEmail,
  isValidPhone,
  normalizePhone,
  isChainBusiness,
  hasWebsiteIndicators,
  calculatePriorityScore,
  sanitizeBusinessName,
  extractEmailFromText,
  delay,
  retryOperation,
  getRandomUserAgent
};
