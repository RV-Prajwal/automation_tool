# 🚀 Quick Start Guide

Get your Business Scraper & Outreach Automation running in 5 minutes!

## Step 1: Install Dependencies (2 mins)

```powershell
npm install
```

This will install all required packages (~150MB).

## Step 2: Configure Environment (1 min)

1. Copy the example environment file:
```powershell
Copy-Item .env.example .env
```

2. Open `.env` in Notepad and edit these **required** fields:

```env
# Where to search for businesses
GOOGLE_MAPS_LOCATION=Bangalore, India

# Your Gmail (for sending emails)
GMAIL_USER=youremail@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx

# Your business info
BUSINESS_PHONE=+91-9876543210
EMAIL_FROM_NAME=Your Web Dev Company
```

### 🔑 Get Gmail App Password

1. Go to: https://myaccount.google.com/security
2. Turn on **2-Step Verification** (if not already on)
3. Search for "App passwords"
4. Create new app password for "Mail"
5. Copy the 16-character code (ignore spaces)
6. Paste into `.env` as `GMAIL_APP_PASSWORD`

## Step 3: Test Run (1 min)

Start in development mode:

```powershell
npm run dev
```

You should see:
```
Business Scraper & Outreach Automation
========================================
Location: Bangalore, India
Application started successfully
```

Press `Ctrl+C` to stop.

## Step 4: Optional - Setup Google Sheets

Skip this if you don't need spreadsheet sync.

1. Go to: https://console.cloud.google.com
2. Create new project
3. Enable "Google Sheets API"
4. Create Service Account
5. Download JSON credentials
6. Save as `config/credentials.json`
7. Create a Google Sheet
8. Share sheet with service account email (from JSON file)
9. Copy sheet ID from URL and add to `.env`:
   ```env
   GOOGLE_SHEETS_ID=your-sheet-id-here
   ```

## Step 5: Run 24/7 (1 min)

Install PM2 (process manager):

```powershell
npm install -g pm2
```

Start the automation:

```powershell
npm run pm2:start
```

Monitor the system:

```powershell
npm run pm2:monit
```

## 🎯 What Happens Next?

The system will automatically:

### Daily at 2:00 AM
- Scrape Google Maps for businesses
- Filter out chains and businesses with websites
- Save qualified leads to database

### Daily at 10:00 AM
- Send personalized emails to new leads
- Send follow-ups to businesses contacted 3 and 7 days ago
- Maximum 50 emails/day (safe limit)

### Every 6 Hours
- Sync all data to Google Sheets (if configured)

### Every Hour
- Health check and log statistics

## 📊 Check Your Progress

View logs:
```powershell
npm run pm2:logs
```

Check database:
```powershell
# Install SQLite viewer
npm install -g sqlite3

# View businesses
sqlite3 ./data/leads.db "SELECT COUNT(*) as total FROM businesses;"

# View qualified leads
sqlite3 ./data/leads.db "SELECT name, priority_score FROM businesses WHERE has_website=0 ORDER BY priority_score DESC LIMIT 10;"
```

## 🛑 Stop the System

```powershell
npm run pm2:stop
```

## ⚠️ Important Notes

1. **Email Limits**: Gmail allows ~500 emails/day, we default to 50 for safety
2. **Scraping Speed**: Intentionally slow (3-7s delays) to avoid detection
3. **First Run**: May take 10-15 minutes to scrape 100 businesses
4. **Browser**: Puppeteer downloads Chromium (~170MB) on first run

## 🔧 Customize Settings

Edit `.env` to change:

```env
# Scrape more/less businesses per run
MAX_BUSINESSES_PER_RUN=100

# Change email limit
MAX_DAILY_EMAILS=50

# Change scraping location
GOOGLE_MAPS_LOCATION=Mumbai, India

# Change search query
GOOGLE_MAPS_SEARCH_QUERY=restaurants near me

# Change your service price
SERVICE_PRICE=15000
```

## 🆘 Troubleshooting

### "Cannot find module 'puppeteer'"
```powershell
npm install
```

### "Failed to launch browser"
```powershell
npx puppeteer browsers install chrome
```

### "Email authentication failed"
- Make sure 2FA is enabled on Gmail
- Use App Password, not regular password
- Remove spaces from App Password

### "Database is locked"
```powershell
npm run pm2:stop
Remove-Item data/leads.db-shm, data/leads.db-wal -ErrorAction Ignore
```

## 📈 Expected Results

After 1 week of operation:
- ~700 businesses scraped (100/day)
- ~300-400 qualified leads (without websites)
- ~350 emails sent (50/day)
- ~5-10 responses (1-3% response rate)
- ~1-2 potential clients

## 🎉 You're All Set!

The system is now running autonomously. It will:
- ✅ Find businesses without websites
- ✅ Send personalized outreach emails
- ✅ Follow up automatically
- ✅ Track all metrics
- ✅ Sync to Google Sheets

Check logs regularly and respond to any interested leads!

---

Need help? Check the full README.md for advanced configuration.
