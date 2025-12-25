# VPS Deployment Guide - Manufacturing Process API

## Prerequisites

- VPS dengan Ubuntu 20.04/22.04 atau CentOS 7/8
- Node.js v14.x atau lebih baru
- PM2 untuk process management
- Nginx untuk reverse proxy (optional)
- Domain name (optional, tapi recommended)

## Step 1: Persiapan VPS

### 1.1 Update System
```bash
sudo apt update && sudo apt upgrade -y
```

### 1.2 Install Node.js
```bash
# Install Node.js 18.x LTS
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version
npm --version
```

### 1.3 Install PM2
```bash
sudo npm install -g pm2
```

## Step 2: Upload Project ke VPS

### Option A: Using Git (Recommended)
```bash
cd /var/www
sudo mkdir manufacturing-api
sudo chown $USER:$USER manufacturing-api
cd manufacturing-api

git clone <your-repo-url> .
```

### Option B: Using SCP/SFTP
```bash
# From local machine
scp -r Manufacturing-Process-Production-Authenticity user@your-vps-ip:/var/www/
```

## Step 3: Setup Project

### 3.1 Install Dependencies
```bash
cd /var/www/manufacturing-api

# Install server dependencies
cd server
npm install --production
cd ..

# Install client dependencies and build
cd client
npm install
npm run build
cd ..
```

### 3.2 Create Environment File
```bash
cd server
cp ../.env.example .env
nano .env
```

Edit `.env` file:
```env
NODE_ENV=production
PORT=3000

# IMPORTANT: Change this to a secure random string
API_KEY=your_very_secure_random_api_key_12345

# Add your VPS IP or domain
ALLOWED_ORIGINS=https://yourdomain.com,http://your-vps-ip:3000

# Odoo Configuration
ODOO_API_URL=https://foomx.odoo.com
ODOO_SESSION_ID=your_actual_session_id

DATABASE_PATH=./database.sqlite
LOG_LEVEL=info

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### 3.3 Setup Database Permissions
```bash
cd server
touch database.sqlite
chmod 664 database.sqlite
```

## Step 4: Configure PM2

### 4.1 Create PM2 Ecosystem File
```bash
cd /var/www/manufacturing-api
nano ecosystem.config.js
```

Add this content:
```javascript
module.exports = {
  apps: [{
    name: 'manufacturing-api',
    cwd: './server',
    script: 'index.js',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    max_memory_restart: '500M',
    watch: false
  }]
};
```

### 4.2 Create Log Directory
```bash
mkdir -p server/logs
```

### 4.3 Start Application with PM2
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 4.4 Monitor Application
```bash
# View logs
pm2 logs manufacturing-api

# View status
pm2 status

# Restart app
pm2 restart manufacturing-api

# Stop app
pm2 stop manufacturing-api
```

## Step 5: Setup Nginx (Optional but Recommended)

### 5.1 Install Nginx
```bash
sudo apt install -y nginx
```

### 5.2 Create Nginx Configuration
```bash
sudo nano /etc/nginx/sites-available/manufacturing-api
```

Add this configuration:
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;  # Change this

    # Client (Frontend)
    location / {
        root /var/www/manufacturing-api/client/build;
        try_files $uri $uri/ /index.html;
        index index.html;
    }

    # API (Backend)
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeout settings
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://localhost:3000/health;
        access_log off;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json;
}
```

### 5.3 Enable Site
```bash
sudo ln -s /etc/nginx/sites-available/manufacturing-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## Step 6: Setup SSL with Let's Encrypt (Recommended)

### 6.1 Install Certbot
```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 6.2 Obtain SSL Certificate
```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

### 6.3 Auto-renewal
```bash
# Test auto-renewal
sudo certbot renew --dry-run

# Certbot will automatically setup cron job for renewal
```

## Step 7: Setup Firewall

```bash
# Enable UFW
sudo ufw enable

# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Check status
sudo ufw status
```

## Step 8: Testing the Deployment

### 8.1 Test Backend Health
```bash
curl http://localhost:3000/health
```

### 8.2 Test External API
```bash
curl -X GET "http://localhost:3000/api/external/manufacturing-data?mo_number=PROD/MO/28204&completed_at=all" \
  -H "X-API-Key: your_api_key_here"
```

### 8.3 Test from External
```bash
# From your local machine
curl -X GET "http://your-vps-ip/api/health"
curl -X GET "https://yourdomain.com/api/health"
```

## Step 9: Monitoring & Maintenance

### 9.1 Monitor PM2 Processes
```bash
pm2 monit
```

### 9.2 View Logs
```bash
# PM2 logs
pm2 logs manufacturing-api --lines 100

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### 9.3 Database Backup
```bash
# Create backup script
nano /var/www/manufacturing-api/backup.sh
```

Add:
```bash
#!/bin/bash
BACKUP_DIR="/var/backups/manufacturing-api"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# Backup database
cp /var/www/manufacturing-api/server/database.sqlite $BACKUP_DIR/database_$DATE.sqlite

# Keep only last 7 days of backups
find $BACKUP_DIR -name "database_*.sqlite" -mtime +7 -delete

echo "Backup completed: database_$DATE.sqlite"
```

Make executable:
```bash
chmod +x /var/www/manufacturing-api/backup.sh
```

Setup cron job:
```bash
crontab -e
```

Add:
```
# Backup database daily at 2 AM
0 2 * * * /var/www/manufacturing-api/backup.sh
```

## Step 10: Security Best Practices

### 10.1 Change Default Credentials
- Change login credentials in production
- Use environment variables for sensitive data

### 10.2 Regular Updates
```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Update Node packages
cd /var/www/manufacturing-api/server
npm audit
npm update
```

### 10.3 Monitor Server Resources
```bash
# Install htop
sudo apt install htop

# Check CPU and Memory
htop

# Check disk usage
df -h

# Check database size
du -sh /var/www/manufacturing-api/server/database.sqlite
```

## Troubleshooting

### Issue: Port already in use
```bash
# Find process using port 3000
sudo lsof -i :3000
sudo kill -9 <PID>
```

### Issue: Permission denied
```bash
# Fix file permissions
sudo chown -R $USER:$USER /var/www/manufacturing-api
chmod -R 755 /var/www/manufacturing-api
```

### Issue: Database locked
```bash
# Stop all PM2 processes
pm2 stop all

# Remove database lock
rm -f /var/www/manufacturing-api/server/database.sqlite-wal
rm -f /var/www/manufacturing-api/server/database.sqlite-shm

# Restart
pm2 start ecosystem.config.js
```

### Issue: High memory usage
```bash
# Check PM2 processes
pm2 status

# Restart specific app
pm2 restart manufacturing-api

# Flush logs if too large
pm2 flush
```

## API Key Security

### For External API Access:

When calling the external API from other applications, include the API key in the header:

```bash
curl -X GET "https://yourdomain.com/api/external/manufacturing-data?mo_number=PROD/MO/28204&completed_at=all" \
  -H "X-API-Key: your_secure_api_key"
```

```javascript
// JavaScript/Axios example
const response = await axios.get('https://yourdomain.com/api/external/manufacturing-data', {
  params: {
    mo_number: 'PROD/MO/28204',
    completed_at: 'all'
  },
  headers: {
    'X-API-Key': 'your_secure_api_key'
  }
});
```

## Performance Optimization

### Enable Node.js Cluster Mode
Already configured in PM2 ecosystem file with 2 instances.

### Database Optimization
```bash
# Run SQLite VACUUM periodically
sqlite3 /var/www/manufacturing-api/server/database.sqlite "VACUUM;"
```

### Nginx Caching (Optional)
Add to Nginx config for static assets:
```nginx
location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

## Updating the Application

```bash
cd /var/www/manufacturing-api

# Pull latest changes
git pull origin main

# Update dependencies
cd server && npm install --production && cd ..
cd client && npm install && npm run build && cd ..

# Restart PM2
pm2 restart manufacturing-api

# Check logs
pm2 logs manufacturing-api --lines 50
```

## Contact & Support

For issues or questions, refer to the main README.md or API_DOCUMENTATION.md

