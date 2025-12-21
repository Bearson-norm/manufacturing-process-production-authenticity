# 🔧 Troubleshooting Guide

## Issue: PM2 tidak terlihat di `pm2 status`

### Problem
App di-start dengan `sudo`, jadi PM2 process ada di root user, bukan user foom.

### Solution

```bash
# Check PM2 sebagai root
sudo pm2 status

# Atau check semua PM2 processes
sudo pm2 list

# Check logs
sudo pm2 logs manufacturing-app

# Restart jika perlu
sudo pm2 restart manufacturing-app
```

## Issue: Health endpoint tidak accessible

### Problem
- Health endpoint ada di `/health`, bukan `/api/health`
- Nginx config perlu update

### Solution

```bash
# Test langsung ke app
curl http://localhost:1234/health

# Test via Nginx (setelah config di-update)
curl http://mpr.moof-set.web.id/health
curl http://mpr.moof-set.web.id/api/health
```

## Issue: App tidak running

### Check Steps

```bash
# 1. Check PM2 (as root)
sudo pm2 status

# 2. Check port
sudo lsof -i :1234

# 3. Check logs
sudo pm2 logs manufacturing-app

# 4. Check if directory exists
ls -la /root/deployments/manufacturing-app/server/
ls -la /home/foom/deployments/manufacturing-app/server/

# 5. Restart app
cd /root/deployments/manufacturing-app/server
# atau
cd /home/foom/deployments/manufacturing-app/server

sudo pm2 restart manufacturing-app
```

## Quick Fix Commands

```bash
# Verify deployment
cd /var/www/manufacturing-process-production-authenticity
chmod +x .github/scripts/verify-deployment.sh
./.github/scripts/verify-deployment.sh

# Check PM2 as root
sudo pm2 status
sudo pm2 logs manufacturing-app --lines 50

# Test endpoints
curl http://localhost:1234/health
curl http://mpr.moof-set.web.id/health
curl http://mpr.moof-set.web.id/api/health

# Restart if needed
sudo pm2 restart manufacturing-app
sudo systemctl reload nginx
```

