# 🚀 Quick Deploy Guide - Port 1234 & Domain mpr.moof-set.web.id

## ✅ Yang Sudah Dikonfigurasi

### 1. Server Configuration
- ✅ Port: **1234** (default)
- ✅ Domain: **mpr.moof-set.web.id**
- ✅ PM2 Cluster Mode: Multiple instances untuk handle concurrent users
- ✅ Database WAL Mode: Optimized untuk concurrent access

### 2. Performance Optimizations
- ✅ PM2 Cluster Mode: Auto-scale berdasarkan CPU cores
- ✅ Nginx Load Balancing: Least connections algorithm
- ✅ Rate Limiting: API (50 req/s), General (100 req/s)
- ✅ Database Connection Pooling: WAL mode enabled
- ✅ Static Asset Caching: 1 year cache

### 3. Files Updated
- ✅ `server/index.js` - Port 1234, database optimizations
- ✅ `server/ecosystem.config.js` - PM2 cluster configuration
- ✅ `.github/scripts/setup-vps.sh` - Nginx config dengan domain
- ✅ `.github/scripts/deploy.sh` - PM2 cluster deployment
- ✅ `DOMAIN_SETUP.md` - Complete setup guide

## 🎯 Langkah Cepat Deploy

### Step 1: Setup DNS
Point domain `mpr.moof-set.web.id` ke IP `103.31.39.189`:
```
Type: A
Name: mpr
Value: 103.31.39.189
TTL: 3600
```

### Step 2: Deploy ke VPS
```bash
# Push ke GitHub (akan trigger auto-deploy)
git add .
git commit -m "Configure port 1234 and domain mpr.moof-set.web.id"
git push origin main
```

### Step 3: Setup di VPS (First Time)
```bash
# SSH ke VPS
ssh foom@103.31.39.189

# Jalankan setup script (jika belum)
# Upload .github/scripts/setup-vps.sh ke VPS, lalu:
chmod +x setup-vps.sh
./setup-vps.sh
```

### Step 4: Setup SSL (Recommended)
```bash
ssh foom@103.31.39.189
sudo apt-get install certbot python3-certbot-nginx -y
sudo certbot --nginx -d mpr.moof-set.web.id
```

### Step 5: Verify
```bash
# Test domain
curl -I https://mpr.moof-set.web.id

# Test API
curl https://mpr.moof-set.web.id/api/login -X POST \
  -H "Content-Type: application/json" \
  -d '{"username":"production","password":"production123"}'

# Check PM2 (harus multiple instances)
pm2 status
```

## 📊 Expected Performance

Dengan konfigurasi ini, sistem dapat handle:
- ✅ **10+ concurrent users** tanpa masalah
- ✅ **50+ requests/second** untuk API
- ✅ **Response time < 200ms** untuk most requests
- ✅ **Auto-scaling** berdasarkan CPU cores
- ✅ **High availability** dengan PM2 auto-restart

## 🔍 Monitoring

```bash
# PM2 monitoring
pm2 monit
pm2 logs manufacturing-app

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Application logs
cd ~/deployments/manufacturing-app/server
tail -f logs/out.log
tail -f logs/err.log
```

## 🐛 Troubleshooting

### Port 1234 tidak accessible
```bash
sudo ufw allow 1234/tcp
sudo netstat -tulpn | grep 1234
```

### PM2 tidak start dengan cluster mode
```bash
cd ~/deployments/manufacturing-app/server
pm2 delete manufacturing-app
pm2 start ecosystem.config.js
pm2 save
```

### Domain tidak resolve
```bash
nslookup mpr.moof-set.web.id
# Harus return: 103.31.39.189
```

## 📝 Important Notes

1. **Port 1234** digunakan untuk internal (Nginx → Node.js)
2. **External access** melalui port **443** (HTTPS) atau **80** (HTTP)
3. **PM2 cluster** akan otomatis menggunakan semua CPU cores
4. **Database WAL mode** memungkinkan concurrent read/write
5. **Rate limiting** membantu prevent abuse

## 🎉 Selesai!

Setelah setup selesai, aplikasi dapat diakses di:
- **HTTPS**: https://mpr.moof-set.web.id
- **HTTP**: http://mpr.moof-set.web.id (redirect ke HTTPS)

---

Lihat `DOMAIN_SETUP.md` untuk detail lengkap setup domain dan SSL.

