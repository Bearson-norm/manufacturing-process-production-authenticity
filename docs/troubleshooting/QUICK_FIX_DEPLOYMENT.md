# 🔧 Quick Fix - Deployment Issues

## ✅ Status Saat Ini

- ✅ App sudah di-deploy
- ✅ PM2 start dengan 2 instances (cluster mode)
- ⚠️ PM2 tidak terlihat karena di-start sebagai root
- ⚠️ Health endpoint routing perlu fix

## 🚀 Quick Fix

### Step 1: Check PM2 sebagai Root

```bash
# PM2 di-start sebagai root, jadi check dengan sudo
sudo pm2 status

# Check logs
sudo pm2 logs manufacturing-app --lines 50

# Check apakah app benar-benar running
sudo pm2 list | grep manufacturing-app
```

### Step 2: Test App Langsung

```bash
# Test langsung ke app (bypass Nginx)
curl http://localhost:1234/health

# Jika tidak return, check apakah app running
sudo lsof -i :1234
```

### Step 3: Update Nginx Config

```bash
# Update Nginx config untuk health endpoint
sudo nano /etc/nginx/sites-available/manufacturing-app
```

Tambahkan setelah location /api block:
```nginx
location /api/health {
    proxy_pass http://127.0.0.1:1234/health;
    proxy_set_header Host $host;
    access_log off;
}
```

Atau reload config yang sudah di-update:
```bash
# Test config
sudo nginx -t

# Reload
sudo systemctl reload nginx
```

### Step 4: Test Endpoints

```bash
# Test langsung app
curl http://localhost:1234/health

# Test via Nginx
curl http://mpr.moof-set.web.id/health
curl http://mpr.moof-set.web.id/api/health
curl http://mpr.moof-set.web.id/api/login -X POST -H "Content-Type: application/json" -d '{"username":"production","password":"production123"}'
```

## 🔍 Debug Commands

```bash
# Check PM2 (as root)
sudo pm2 status
sudo pm2 logs manufacturing-app

# Check port
sudo lsof -i :1234
sudo netstat -tulpn | grep 1234

# Check Nginx
sudo nginx -t
sudo systemctl status nginx
sudo tail -f /var/log/nginx/manufacturing-app-error.log

# Check app directory
ls -la /root/deployments/manufacturing-app/server/
ls -la /home/foom/deployments/manufacturing-app/server/
```

## 📝 Complete Fix Sequence

```bash
# 1. Check PM2 as root
sudo pm2 status

# 2. Check logs
sudo pm2 logs manufacturing-app --lines 20

# 3. Test app directly
curl -v http://localhost:1234/health

# 4. Update Nginx config (if needed)
sudo nano /etc/nginx/sites-available/manufacturing-app
# Add /api/health location block

# 5. Reload Nginx
sudo nginx -t && sudo systemctl reload nginx

# 6. Test via Nginx
curl http://mpr.moof-set.web.id/api/health
```

## 🎯 Expected Results

Setelah fix:
- ✅ `sudo pm2 status` menunjukkan manufacturing-app (2 instances)
- ✅ `curl http://localhost:1234/health` return JSON
- ✅ `curl http://mpr.moof-set.web.id/api/health` return JSON
- ✅ Frontend accessible di http://mpr.moof-set.web.id

---

**Run commands di atas untuk fix issues!** 🔧

