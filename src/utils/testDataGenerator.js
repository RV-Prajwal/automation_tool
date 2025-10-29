import logger from './logger.js';
import config from '../config/config.js';

// Generate fake business data for testing
export function generateTestBusinesses(count = 10, location = 'Austin') {
  logger.info(`Generating ${count} test businesses for ${location}`);
  
  const categories = [
    'Restaurant', 'Cafe', 'Retail Store', 'Beauty Salon', 
    'Gym', 'Bookstore', 'Bakery', 'Pharmacy', 'Pet Store',
    'Clothing Store', 'Electronics Shop', 'Grocery Store'
  ];
  
  const businessTypes = [
    'The Golden', 'Sunrise', 'Blue Moon', 'Green Valley', 'Royal',
    'Premium', 'Elite', 'Modern', 'Classic', 'Urban', 'Fusion'
  ];
  
  const areas = [
    'Downtown', 'South Congress', 'North Austin', 'East Austin',
    'West Lake Hills', 'Round Rock', 'Cedar Park', 'Pflugerville'
  ];
  
  const businesses = [];
  
  for (let i = 0; i < count; i++) {
    const category = categories[Math.floor(Math.random() * categories.length)];
    const type = businessTypes[Math.floor(Math.random() * businessTypes.length)];
    const area = areas[Math.floor(Math.random() * areas.length)];
    
    const rating = (3.5 + Math.random() * 1.5).toFixed(1);
    const reviewCount = Math.floor(Math.random() * 500) + 10;
    
    // Austin center coords: 30.2672, -97.7431
    const bounds = config.googleMaps?.bounds || { north: 30.45, south: 30.15, east: -97.65, west: -97.75 };
    const centerLat = (bounds.north + bounds.south) / 2;
    const centerLon = (bounds.east + bounds.west) / 2;
    
    businesses.push({
      name: `${type} ${category}`,
      category: category,
      address: `${Math.floor(Math.random() * 999) + 1}, ${area}, ${location}, TX`,
      phone: `+1-${Math.floor(Math.random() * 9000000000) + 2000000000}`,
      email: null,
      hasWebsite: false, // All test businesses don't have websites
      rating: parseFloat(rating),
      reviewCount: reviewCount,
      latitude: centerLat + (Math.random() - 0.5) * 0.15,
      longitude: centerLon + (Math.random() - 0.5) * 0.15
    });
  }
  
  logger.info(`Generated ${businesses.length} test businesses`);
  return businesses;
}

export default { generateTestBusinesses };
