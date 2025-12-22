# ⚡ Quick Update Guide

Panduan cepat untuk update aplikasi di VPS.

## 🚀 Update via CI/CD (Recommended)

```bash
# Di local machine
git add .
git commit -m "Update: deskripsi"
git push origin main

# GitHub Actions akan otomatis deploy
# Monitor: https://github.com/Bearson-norm/manufacturing-process-production-authenticity/actions
```

## 🔧 Update Manual di VPS

### Option 1: Menggunakan Script (Termudah)

```bash
ssh foom@103.31.39.189
cd /var/www/manufacturing-process-production-authenticity
chmod +x .github/scripts/update-app.sh

# Update dengan pull dari Git
./.github/scripts/update-app.sh git

# Atau update code yang sudah ada (tanpa git pull)
./.github/scripts/update-app.sh manual
```

### Option 2: Manual Step-by-Step

```bash
# 1. Pull code
cd /var/www/manufacturing-process-production-authenticity
git pull origin main

# 2. Build client
cd client && npm install && npm run build && cd ..

# 3. Deploy
chmod +x .github/scripts/deploy-manual.sh
sudo ./.github/scripts/deploy-manual.sh
```

## ⏪ Rollback

```bash
# Rollback ke backup sebelumnya
cd /var/www/manufacturing-process-production-authenticity
./.github/scripts/update-app.sh rollback
```

## ✅ Verify

```bash
# Check status
pm2 status

# Test health
curl http://localhost:1234/health
curl -k https://mpr.moof-set.web.id/api/health

# Check logs
pm2 logs manufacturing-app --lines 20
```

## 🐛 Troubleshooting

```bash
# App tidak start?
pm2 logs manufacturing-app --err

# Port conflict?
sudo lsof -i :1234

# Restart
pm2 restart manufacturing-app
```

---

**📖 Untuk panduan lengkap, lihat: [UPDATE_GUIDE.md](UPDATE_GUIDE.md)**
