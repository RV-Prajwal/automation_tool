# Google Maps Scraper Fix - Click on Each Business

## Problem Identified ✓

The scraper was successfully:
- Loading Google Maps
- Searching for "businesses near me in Bangalore"
- Finding business listings in the sidebar (visible in screenshot)
- Scrolling through the list

**BUT** it was extracting **ZERO businesses** because it was only trying to scrape data from the list view, which has limited information.

## Root Cause

Looking at the screenshot (`logs/scraping-debug.png`), we could see multiple businesses listed:
- MGB Bengaluru
- Startup Company Registration
- ET Business Consulting
- K K Raj & Co. Chartered Accountants
- R K Associates
- BlauPlug Innovations Pvt Ltd
- etc.

The scraper was **scrolling the list** but **NOT clicking on each business** to view their detailed information panel where the actual data (address, phone, website, etc.) is displayed.

## The Fix

Updated `src/scrapers/googleMapsScraper.js` to:

1. **Count all business cards** in the sidebar list
2. **Click on each business** one by one (using index-based iteration)
3. **Wait for details panel** to load after each click (3-5 seconds)
4. **Extract detailed information** from the opened panel:
   - Name (from `h1.DUwDvf`)
   - Category (from category button)
   - Rating and review count (from rating section)
   - **Address** (from `button[data-item-id^="address"]`)
   - **Phone** (from phone button)
   - **Website** (checking if website link exists)
5. Move to next business with small delay (1-2 seconds)

## Key Changes

### Before (Old Code):
```javascript
// Just tried to extract from list view
const businesses = await this.page.evaluate(() => {
  const cards = document.querySelectorAll('div[role="article"]');
  // ... tried to extract from cards directly
});
```

### After (New Code):
```javascript
// Click on each business to get full details
for (let i = 0; i < businessCount; i++) {
  // Click on business card
  await this.page.evaluate((index) => {
    const cards = document.querySelectorAll('div[role="article"]');
    cards[index].click();
  }, i);
  
  // Wait for details panel
  await delay(3000, 5000);
  
  // Extract from details panel
  const business = await this.page.evaluate(() => {
    // Extract name, address, phone, website, etc. from details view
  });
  
  businesses.push(business);
}
```

## What to Expect Now

When you trigger scraping again (or wait for the scheduled job), you should see:

1. Browser opening and navigating to Google Maps ✓
2. Searching for businesses ✓
3. Scrolling the list ✓
4. **Clicking on EACH business** one by one (NEW!)
5. Extracting full details from each business panel (NEW!)
6. Saving to database with complete information

## Test the Fix

### Option 1: Use the Dashboard "Manual Run" button
1. Go to http://localhost:3000
2. Click "Run Manual Scraping"
3. Watch the logs to see it clicking on businesses

### Option 2: Check the logs
```bash
npx pm2 logs business-scraper
```

You should see logs like:
```
[INFO] Found 20 businesses in the list
[INFO] Processing business 1/20
[INFO] ✓ Extracted: MGB Bengaluru
[INFO] Processing business 2/20
[INFO] ✓ Extracted: Startup Company Registration
...
[INFO] Successfully extracted 20 out of 20 businesses
```

## Important Notes

- Each business takes 3-5 seconds to load after clicking (anti-detection delays)
- Scraping 20 businesses will take approximately **2-3 minutes** now
- This is **necessary** to extract complete data (phone, address, website)
- The delays also help avoid Google's rate limiting

## Next Steps

If scraping still returns zero businesses after this fix, it would mean:
1. Google changed their HTML selectors (unlikely - just happened)
2. Need to adjust wait times
3. CAPTCHA or additional blocking (check the browser window)

But based on the screenshot showing the list successfully loaded, this fix should work! 🎯
