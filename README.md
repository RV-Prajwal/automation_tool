# Business Scraper & Outreach Automation Tool

Automated business lead generation tool that scrapes Google Maps for businesses in Austin, Texas, qualifies leads, and manages outreach campaigns.

## 🚀 Features

- **Zone-Based Scraping**: Systematic scraping using a 10x10 grid system covering Austin, TX
- **Fresh Browser Sessions**: Bypasses Google Maps caching for accurate location data
- **Lead Qualification**: Targets businesses without websites (prime conversion candidates)
- **Data Export**: CSV exports for SMS and email campaigns
- **Web Dashboard**: Real-time monitoring and control at http://localhost:3000
- **Email Automation**: Personalized outreach campaigns with follow-up sequences
- **24/7 Operation**: Production-ready with PM2 process management
- **MySQL Database**: Robust data storage with zone tracking

## 📋 Prerequisites

- Node.js 18+ 
- MySQL Database
- Gmail account with App Password
- Google Sheets API credentials (optional)
- Chrome/Chromium browser
- Windows/Linux/Mac OS

## 🛠️ Installation

### 1. Install Dependencies

```powershell
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env`:

```powershell
Copy-Item .env.example .env
```

Edit `.env` and configure:

```env
# Target Location
GOOGLE_MAPS_LOCATION=Austin, Texas
ZONE_BASED_SCRAPING=true
BOUNDS_NORTH=30.45
BOUNDS_SOUTH=30.15
BOUNDS_EAST=-97.65
BOUNDS_WEST=-97.75

# Email Configuration
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-16-char-app-password
BUSINESS_PHONE=+1-XXX-XXX-XXXX

# Database
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_db_password
DB_NAME=business_scraper

# Optional
GOOGLE_SHEETS_ID=your-sheet-id
```

### 3. Setup Gmail App Password

1. Go to Google Account → Security
2. Enable 2-Factor Authentication
3. Generate App Password for "Mail"
4. Copy the 16-character password to `.env`

### 4. Setup Google Sheets (Optional)

1. Create a Google Cloud Project
2. Enable Google Sheets API
3. Create Service Account
4. Download credentials JSON
5. Save as `config/credentials.json`
6. Share your sheet with service account email

## 🎯 Usage

### Development Mode

```powershell
npm run dev
```

### Production Mode (24/7)

```powershell
# Install PM2 globally
npm install -g pm2

# Start application
npm run pm2:start

# Monitor
npm run pm2:monit

# View logs
npm run pm2:logs

# Stop
npm run pm2:stop
```

### Manual Operations

Run one-time scraping:
```javascript
node -e "import('./src/index.js').then(app => app.runScrapingJob())"
```

Run email campaign:
```javascript
node -e "import('./src/index.js').then(app => app.runEmailJob())"
```

## 📅 Scheduled Jobs

- **2:00 AM**: Daily business scraping
- **10:00 AM**: Email campaigns (initial + follow-ups)
- **Every 6 hours**: Google Sheets sync
- **Every hour**: Health check

Configure in `.env`:
```env
SCRAPING_CRON=0 2 * * *
EMAIL_CRON=0 10 * * *
SHEETS_SYNC_CRON=0 */6 * * *
```

## 📊 Database

SQLite database stores:
- Business information
- Outreach history
- Unsubscribe list
- Daily metrics

Location: `./data/leads.db`

View database:
```powershell
# Install SQLite viewer
npm install -g sqlite3

# Open database
sqlite3 ./data/leads.db
```

## 🔒 Safety Features

- **Daily email limit**: 50 emails/day (configurable)
- **Rate limiting**: 3-7 second delays between scrapes
- **Anti-detection**: Randomized user agents, headless mode
- **Unsubscribe**: Automatic tracking
- **Error recovery**: Auto-restart on crashes

## 📈 Monitoring

### View Stats
```powershell
npm run pm2:monit
```

### Check Logs
```powershell
# Application logs
Get-Content logs/app-*.log -Tail 50

# Error logs
Get-Content logs/error-*.log -Tail 50

# PM2 logs
npm run pm2:logs
```

### Health Metrics
Logged every hour with:
- Total businesses scraped
- Qualified leads
- Emails sent today
- Conversion statistics

## 🎨 Email Templates

Templates are category-specific:
- Restaurant/Cafe/Food
- Retail/Shop/Store
- Services/Repair
- Default (fallback)

Edit templates in: `src/config/templates.js`

## 🔧 Configuration

All settings in `.env`:

| Setting | Default | Description |
|---------|---------|-------------|
| `MAX_BUSINESSES_PER_RUN` | 100 | Businesses per scraping session |
| `MAX_DAILY_EMAILS` | 50 | Email quota per day |
| `SCRAPING_DELAY_MIN` | 3000 | Min delay between scrapes (ms) |
| `SCRAPING_DELAY_MAX` | 7000 | Max delay between scrapes (ms) |
| `HEADLESS_MODE` | true | Run browser in background |

## 🐛 Troubleshooting

### Puppeteer Issues
```powershell
# Install Chromium manually
npx puppeteer browsers install chrome
```

### Database Locked
```powershell
# Stop all instances
npm run pm2:stop

# Remove lock file
Remove-Item data/leads.db-shm, data/leads.db-wal -ErrorAction Ignore
```

### Email Not Sending
- Verify App Password (16 characters, no spaces)
- Check Gmail "Less secure apps" settings
- Ensure 2FA is enabled

## 📁 Project Structure

```
automation/
├── src/
│   ├── config/          # Configuration files
│   ├── scrapers/        # Google Maps scraper
│   ├── processors/      # Lead qualification
│   ├── integrations/    # Email & Sheets
│   ├── services/        # Outreach manager
│   ├── utils/           # Helpers & database
│   └── index.js         # Main application
├── data/                # SQLite database
├── logs/                # Application logs
├── .env                 # Environment variables
└── package.json         # Dependencies
```

## 🚦 System Requirements

- **RAM**: 200-300 MB
- **CPU**: <10% average
- **Disk**: 100 MB + logs
- **Network**: Stable internet connection

## ⚠️ Legal Compliance

- **CAN-SPAM**: Unsubscribe link in every email
- **GDPR**: Secure data storage, opt-out support
- **Rate Limiting**: Respects platform terms of service

## 🤝 Support

For issues or questions:
1. Check logs in `logs/` directory
2. Review configuration in `.env`
3. Ensure all prerequisites are met

## 📝 License

MIT License - See LICENSE file for details

---

**Made with ❤️ for local business outreach**
