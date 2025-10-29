# Enhancement Plan: Dynamic Location-Based Scraping

## Current State Analysis

### How It Works Now:
1. **Config** (`config.js`): Hardcoded location = "Bangalore, India"
2. **Scraper** (`googleMapsScraper.js`): 
   - Searches: `"businesses near me in Bangalore, India"`
   - Sets geolocation: `latitude: 12.9716, longitude: 77.5946` (Bangalore center)
   - Extracts businesses with their address but NO location coordinates stored
3. **Database** (`schema.sql`):
   - Has `latitude` and `longitude` columns in businesses table but currently not populated
   - No tracking of scraped areas/zones

### Issues with Current Approach:
- **Same search every time** → Gets duplicate results
- **No coverage tracking** → Doesn't know which areas already scraped
- **Covers whole Bangalore uniformly** → Inefficient, lots of overlaps
- **Can't resume from where it stopped** → Waste of resources

---

## Proposed Enhancement Strategy

### 1. **Zone/Area Division System**

#### Option A: Grid-Based (Recommended for Large City)
- Divide Bangalore into a **latitude-longitude grid**
- Create 10x10 or custom grid cells
- Each cell = one scraping session
- Example:
  ```
  Cell (1,1): Lat 12.80-12.85, Long 77.40-77.45
  Cell (1,2): Lat 12.80-12.85, Long 77.45-77.50
  ... (100 cells total for Bangalore)
  ```

#### Option B: Locality-Based
- Pre-define all localities in Bangalore (HSR Layout, Koramangala, etc.)
- Cycle through each locality
- More human-like but requires manual maintenance

### 2. **Database Schema Changes**

#### Add New Table: `scraped_zones`
```sql
CREATE TABLE scraped_zones (
  id INT PRIMARY KEY AUTO_INCREMENT,
  zone_name VARCHAR(100) NOT NULL,           -- "Grid_12.80_77.40" or "HSR_Layout"
  zone_type ENUM('grid', 'locality') DEFAULT 'grid',
  latitude_min DECIMAL(10,8),
  latitude_max DECIMAL(10,8),
  longitude_min DECIMAL(11,8),
  longitude_max DECIMAL(11,8),
  last_scraped_at TIMESTAMP NULL,
  business_count INT DEFAULT 0,
  status ENUM('pending', 'in_progress', 'completed') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_last_scraped (last_scraped_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

#### Update `businesses` Table:
- Populate `latitude` and `longitude` from Google Maps data
- Add `zone_id` foreign key to track which zone it came from
- Add `scraping_timestamp` to identify duplicate batches

### 3. **Core Implementation Steps**

#### Step 1: Create Zone Generator (`utils/zoneManager.js`)
```javascript
- generateGridZones(lat_min, lat_max, lon_min, lon_max, gridSize)
  → Creates array of zone objects with boundaries
- getNextZoneToScrape()
  → Queries DB for oldest/unscraped zone
- markZoneAsInProgress(zoneId)
- markZoneAsCompleted(zoneId)
```

#### Step 2: Update Scraper (`scrapers/googleMapsScraper.js`)
```javascript
- searchBusinesses(query, location, latitude, longitude)
  → Accept specific coordinates instead of location string
  → Set geolocation to center of zone
  → Search radius should be smaller (e.g., "2km" instead of "10km")
- extractBusinesses() with zone tracking
  → Extract latitude/longitude from address (geocoding) OR use map data
  → Return businesses with coordinates
```

#### Step 3: Modify Config (`config.js`)
```javascript
googleMaps: {
  searchQuery: 'businesses near me',
  location: 'Bangalore, India',  // Fallback/display only
  
  // NEW: Zone-based scraping
  zoneBasedScraping: true,
  gridSize: 10,  // 10x10 grid for Bangalore
  searchRadius: '2km',  // Smaller radius per zone
  
  // Bangalore boundaries (approximate)
  bounds: {
    north: 13.1288,
    south: 12.7383,
    east: 77.8221,
    west: 77.4564
  }
}
```

#### Step 4: Update Scheduler (`index.js`)
```javascript
setupScheduledJobs() {
  if (config.scheduling.enableAutoScraping) {
    // Instead of: await this.runScrapingJob()
    // Do: await this.runScrapingJobByZone()
  }
}

async runScrapingJobByZone() {
  1. Get next pending zone from DB
  2. If none, reset all zones to pending
  3. Set zone to "in_progress"
  4. Call scraper.searchBusinesses(query, zone.center)
  5. Extract businesses with coordinates
  6. Store in DB with zone_id
  7. Mark zone as "completed"
}
```

#### Step 5: Enhance Scraper Data (`scrapers/googleMapsScraper.js`)
```javascript
extractBusinesses() {
  // Existing logic + add:
  
  business.latitude = await extractLatitude()   // From map pinpoint
  business.longitude = await extractLongitude() // From map pinpoint
  // OR use geocoding API if not available on page
  
  return businesses
}
```

---

## Implementation Roadmap

### Phase 1: Database & Zone System (1-2 hours)
- [ ] Add `scraped_zones` table
- [ ] Create `zoneManager.js` utilities
- [ ] Add zone initialization script
- [ ] Update config with bounds

### Phase 2: Scraper Enhancement (2-3 hours)
- [ ] Modify `searchBusinesses()` to accept coordinates
- [ ] Extract lat/lon from business details
- [ ] Update `extractBusinesses()` with zone tracking
- [ ] Test with single zone

### Phase 3: Orchestration (1-2 hours)
- [ ] Update `index.js` scheduling logic
- [ ] Add `runScrapingJobByZone()` method
- [ ] Add zone reset/cleanup logic
- [ ] Error handling for failed zones

### Phase 4: Testing & Optimization (1-2 hours)
- [ ] Test grid generation
- [ ] Verify no duplicate scraping
- [ ] Monitor coverage
- [ ] Adjust grid size if needed

---

## Example Flow After Enhancement

```
Run 1: Scrape Zone (1,1) - HSR Layout area
  → Search "businesses near me" at Lat 12.85, Lon 77.50
  → Extract 50 businesses with their coordinates
  → Store with zone_id = 1, mark zone as "completed"

Run 2: Scrape Zone (1,2) - Koramangala area
  → Search "businesses near me" at Lat 12.85, Lon 77.55
  → Extract 45 businesses with different coordinates
  → Store with zone_id = 2, mark zone as "completed"

Run 3: Scrape Zone (2,1) - Whitefield area
  → (and so on...)

After All Zones Complete:
  → Reset all zones to "pending"
  → Start fresh cycle with latest data
  → Option: Only update businesses not contacted yet
```

---

## Benefits

✅ **No Duplicate Scraping**: Each zone tracked  
✅ **Full Coverage**: Every area of Bangalore eventually scraped  
✅ **Efficient**: Smaller search radius per zone = faster results  
✅ **Scalable**: Can add more cities easily  
✅ **Resumable**: Crash? Just continue from next pending zone  
✅ **Analytics**: See which zones have most businesses  
✅ **Data Quality**: More precise coordinates for each business  

---

## Technical Considerations

1. **Rate Limiting**: Google Maps may throttle zone-by-zone searches
   - Solution: Add configurable delays between zones

2. **Geolocation Accuracy**: Some businesses might be listed in multiple zones
   - Solution: Use UNIQUE constraint on (name, address) - already exists

3. **Coordinate Extraction**: Google Maps page doesn't always show lat/lon
   - Solution: Use reverse geocoding API (Google Geocoding API) for address → coordinates

4. **Grid Size Tuning**: Too many zones = long cycles, too few = duplicates
   - Start with 10x10 (100 zones), adjust based on results

---

## Files to Create/Modify

### New Files:
- `utils/zoneManager.js` - Zone generation & management
- `scripts/initializeZones.js` - One-time zone setup script
- `ENHANCEMENT_PLAN.md` - This document

### Files to Modify:
- `config.js` - Add zone configuration
- `schema.sql` - Add `scraped_zones` table
- `src/scrapers/googleMapsScraper.js` - Accept coordinates, extract lat/lon
- `src/index.js` - Update scraping job logic
- `.env` - Add zone-related variables

---

## Questions to Clarify

1. How often do you want to rescrape each zone? (daily? weekly? monthly?)
2. Should old businesses be updated or kept as-is?
3. Do you want to exclude businesses already contacted?
4. How many zones is reasonable for current infrastructure?

