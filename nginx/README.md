# 🌐 Nginx Setup Guide for Manufacturing App

Panduan setup Nginx sebagai reverse proxy untuk Manufacturing Process Production Authenticity.

## 📋 Overview

Nginx akan:
- ✅ Serve static files (React build)
- ✅ Proxy API requests ke backend (port 1234)
- ✅ Handle SSL/HTTPS
- ✅ Support React Router (SPA)

## 🚀 Quick Setup

### Step 1: Upload Nginx Config

```bash
# Upload folder nginx ke VPS
scp -r nginx foom@103.31.39.189:~/nginx
```

### Step 2: Run Setup Script

```bash
# SSH ke VPS
ssh foom@103.31.39.189

# Jalankan setup
cd ~/nginx
chmod +x setup-nginx.sh
./setup-nginx.sh
```

### Step 3: Verify App is Running

```bash
# Check PM2
pm2 status

# If not running, start it
cd ~/deployments/manufacturing-app/server
pm2 start ecosystem.config.js

# Test app directly
curl http://localhost:1234/health
```

### Step 4: Setup SSL (Recommended)

```bash
# Install Certbot
sudo apt-get install certbot python3-certbot-nginx -y

# Generate SSL certificate
sudo certbot --nginx -d mpr.moof-set.web.id

# Follow prompts:
# - Email: your-email@example.com
# - Agree to terms
# - Redirect HTTP to HTTPS: Yes
```

### Step 5: Test

```bash
# Test HTTP (should redirect to HTTPS)
curl -I http://mpr.moof-set.web.id

# Test HTTPS
curl -I https://mpr.moof-set.web.id

# Test API
curl https://mpr.moof-set.web.id/api/health

# Test frontend
curl https://mpr.moof-set.web.id
```

## 📁 File Structure

```
nginx/
├── manufacturing-app.conf    # Nginx configuration
├── setup-nginx.sh            # Setup script
└── README.md                 # This file
```

## 🔧 Manual Setup (Alternative)

### 1. Create Nginx Config

```bash
sudo nano /etc/nginx/sites-available/manufacturing-app
```

Copy isi dari `manufacturing-app.conf`

### 2. Enable Site

```bash
sudo ln -s /etc/nginx/sites-available/manufacturing-app /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
```

### 3. Test and Reload

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 🔒 SSL Setup

### Automatic (Certbot)

```bash
sudo certbot --nginx -d mpr.moof-set.web.id
```

### Manual SSL Config

Setelah mendapatkan certificate, uncomment SSL lines di config:

```nginx
ssl_certificate /etc/letsencrypt/live/mpr.moof-set.web.id/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/mpr.moof-set.web.id/privkey.pem;
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers HIGH:!aNULL:!MD5;
ssl_prefer_server_ciphers on;
```

## 📊 Configuration Details

### API Proxy

All requests to `/api/*` are proxied to `http://127.0.0.1:1234`

### Static Files

React build files are served from:
```
/home/foom/deployments/manufacturing-app/client-build
```

### React Router Support

All non-API requests serve `index.html` to support client-side routing.

### Caching

- Static assets (JS, CSS, images): 1 year cache
- HTML files: No cache

## 🐛 Troubleshooting

### Nginx won't start

```bash
# Check config
sudo nginx -t

# Check logs
sudo tail -f /var/log/nginx/error.log

# Check if port 80/443 is in use
sudo lsof -i :80
sudo lsof -i :443
```

### 502 Bad Gateway

```bash
# Check if app is running
pm2 status
curl http://localhost:1234/health

# Check Nginx error logs
sudo tail -f /var/log/nginx/manufacturing-app-error.log

# Check app logs
pm2 logs manufacturing-app
```

### 404 Not Found

```bash
# Check if client-build directory exists
ls -la /home/foom/deployments/manufacturing-app/client-build

# Check Nginx config
sudo nginx -t
```

### SSL Certificate Issues

```bash
# Check certificate
sudo certbot certificates

# Renew certificate
sudo certbot renew

# Check Nginx SSL config
sudo nginx -t
```

## 📝 Logs

### Access Logs
```bash
sudo tail -f /var/log/nginx/manufacturing-app-access.log
```

### Error Logs
```bash
sudo tail -f /var/log/nginx/manufacturing-app-error.log
```

### Nginx General Logs
```bash
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

## 🔄 Update Configuration

### After changing config:

```bash
# Test config
sudo nginx -t

# Reload (no downtime)
sudo systemctl reload nginx

# Or restart (brief downtime)
sudo systemctl restart nginx
```

## ✅ Verification Checklist

- [ ] Nginx installed and running
- [ ] Configuration file created
- [ ] Site enabled
- [ ] Nginx config test passed
- [ ] App running on port 1234
- [ ] Client build directory exists
- [ ] DNS pointed to VPS
- [ ] SSL certificate generated (optional)
- [ ] HTTP redirects to HTTPS (if SSL enabled)
- [ ] API endpoints working
- [ ] Frontend accessible

## 🎯 Next Steps

After Nginx setup:
1. ✅ Test all endpoints
2. ✅ Setup monitoring (optional)
3. ✅ Configure backup
4. ✅ Document any custom configurations

---

**Nginx setup selesai! Aplikasi dapat diakses di https://mpr.moof-set.web.id** 🎉

