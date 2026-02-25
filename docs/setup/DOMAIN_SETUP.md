# 🌐 Domain Setup Guide - mpr.moof-set.web.id

Panduan setup domain `mpr.moof-set.web.id` dengan port 1234 dan optimasi untuk multiple users.

## 📋 Prerequisites

1. Domain sudah di-point ke IP VPS: `103.31.39.189`
2. VPS sudah di-setup dengan Node.js, PM2, dan Nginx
3. Port 1234 sudah dibuka di firewall

## 🔧 Setup DNS

### 1. Point Domain ke VPS

Di DNS provider (misalnya Cloudflare, Namecheap, dll), tambahkan A record:

```
Type: A
Name: mpr (atau @ untuk root domain)
Value: 103.31.39.189
TTL: 3600 (atau Auto)
```

Atau jika menggunakan subdomain:
```
Type: A
Name: mpr.moof-set.web.id
Value: 103.31.39.189
TTL: 3600
```

### 2. Verify DNS

```bash
# Test DNS resolution
nslookup mpr.moof-set.web.id
# atau
dig mpr.moof-set.web.id

# Harus return: 103.31.39.189
```

## 🔒 Setup SSL Certificate (HTTPS)

### 1. Install Certbot

```bash
ssh foom@103.31.39.189
sudo apt-get update
sudo apt-get install certbot python3-certbot-nginx -y
```

### 2. Generate SSL Certificate

```bash
sudo certbot --nginx -d mpr.moof-set.web.id
```

Ikuti instruksi:
- Email: masukkan email Anda
- Terms: Agree
- Share email: Optional
- Redirect HTTP to HTTPS: Yes (recommended)

### 3. Auto-renewal Setup

Certbot akan otomatis setup auto-renewal. Test dengan:

```bash
sudo certbot renew --dry-run
```

## ⚙️ Konfigurasi yang Sudah Diupdate

### 1. Server Port
- **Port**: `1234` (default, bisa diubah via environment variable `PORT`)
- **File**: `server/index.js`

### 2. PM2 Cluster Mode
- **Instances**: `max` (menggunakan semua CPU cores)
- **Mode**: `cluster` (untuk handle concurrent requests)
- **File**: `server/ecosystem.config.js`

### 3. Nginx Configuration
- **Domain**: `mpr.moof-set.web.id`
- **Port**: `443` (HTTPS), `80` (HTTP redirect)
- **Backend**: `localhost:1234`
- **Load Balancing**: Upstream dengan least_conn
- **Rate Limiting**: API (50 req/s), General (100 req/s)
- **File**: `.github/scripts/setup-vps.sh`

### 4. Database Optimizations
- **WAL Mode**: Enabled (untuk concurrent read/write)
- **Cache Size**: 10MB
- **Synchronous**: NORMAL (balance safety/performance)
- **File**: `server/index.js`

## 🚀 Deployment

### 1. Update GitHub Secrets (jika perlu)

Tidak perlu update, karena port di-handle oleh aplikasi.

### 2. Deploy via GitHub Actions

Push ke branch `main` akan trigger deployment otomatis.

Atau trigger manual:
- GitHub → Actions → Deploy to VPS → Run workflow

### 3. Manual Setup di VPS

```bash
# SSH ke VPS
ssh foom@103.31.39.189

# Update Nginx config
sudo nano /etc/nginx/sites-available/manufacturing-app
# Copy config dari .github/scripts/setup-vps.sh

# Test Nginx config
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx

# Restart PM2 dengan cluster mode
cd ~/deployments/manufacturing-app/server
pm2 delete manufacturing-app
pm2 start ecosystem.config.js
pm2 save
```

## ✅ Verification

### 1. Check Domain

```bash
# Test HTTP (should redirect to HTTPS)
curl -I http://mpr.moof-set.web.id

# Test HTTPS
curl -I https://mpr.moof-set.web.id

# Test API
curl https://mpr.moof-set.web.id/api/login -X POST \
  -H "Content-Type: application/json" \
  -d '{"username":"production","password":"production123"}'
```

### 2. Check PM2 Status

```bash
ssh foom@103.31.39.189
pm2 status
pm2 logs manufacturing-app
```

Harus terlihat multiple instances (sesuai jumlah CPU cores).

### 3. Check Nginx

```bash
sudo systemctl status nginx
sudo nginx -t
```

### 4. Test Load

```bash
# Install Apache Bench (optional)
sudo apt-get install apache2-utils -y

# Test dengan 10 concurrent requests
ab -n 100 -c 10 https://mpr.moof-set.web.id/api/login
```

## 🔍 Monitoring

### PM2 Monitoring

```bash
# Real-time monitoring
pm2 monit

# Check logs
pm2 logs manufacturing-app

# Check metrics
pm2 describe manufacturing-app
```

### Nginx Logs

```bash
# Access logs
sudo tail -f /var/log/nginx/access.log

# Error logs
sudo tail -f /var/log/nginx/error.log
```

### Application Logs

```bash
cd ~/deployments/manufacturing-app/server
tail -f logs/out.log
tail -f logs/err.log
```

## 🎯 Performance Optimizations

### Sudah Dikonfigurasi:

1. **PM2 Cluster Mode**: Multiple instances untuk handle concurrent requests
2. **Database WAL Mode**: Concurrent read/write support
3. **Nginx Load Balancing**: Least connections algorithm
4. **Rate Limiting**: Prevent abuse
5. **Connection Keep-Alive**: Reduce connection overhead
6. **Static Asset Caching**: 1 year cache untuk static files
7. **Proxy Buffering**: Optimize proxy performance

### Expected Performance:

- **Concurrent Users**: Dapat handle 10+ users simultan
- **Response Time**: < 200ms untuk most requests
- **Throughput**: 50+ requests/second untuk API
- **Uptime**: High availability dengan PM2 auto-restart

## 🐛 Troubleshooting

### Domain tidak resolve

```bash
# Check DNS
nslookup mpr.moof-set.web.id

# Check Nginx config
sudo nginx -t

# Check Nginx status
sudo systemctl status nginx
```

### SSL Certificate Error

```bash
# Renew certificate
sudo certbot renew

# Check certificate
sudo certbot certificates
```

### PM2 tidak start

```bash
# Check logs
pm2 logs manufacturing-app --err

# Check ecosystem config
cat ~/deployments/manufacturing-app/server/ecosystem.config.js

# Restart manually
pm2 restart manufacturing-app
```

### Port 1234 tidak accessible

```bash
# Check if port is open
sudo netstat -tulpn | grep 1234

# Check firewall
sudo ufw status

# Allow port
sudo ufw allow 1234/tcp
```

## 📝 Notes

- Port 1234 digunakan untuk internal communication (Nginx → Node.js)
- External access melalui port 443 (HTTPS) atau 80 (HTTP)
- PM2 cluster mode akan otomatis scale berdasarkan CPU cores
- Database menggunakan WAL mode untuk better concurrency
- Rate limiting membantu prevent abuse dan ensure fair usage

## 🔄 Update Configuration

Jika perlu update konfigurasi:

1. Update file di repository
2. Push ke GitHub
3. GitHub Actions akan auto-deploy
4. Atau manual deploy (lihat Deployment section)

---

**Setup selesai! Aplikasi dapat diakses di: https://mpr.moof-set.web.id** 🎉

