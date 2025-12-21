# 🚀 Quick Deploy Guide - Setup App di VPS

Panduan cepat untuk deploy Manufacturing App ke VPS.

## ⚠️ Current Status

- ✅ Nginx sudah dikonfigurasi
- ⚠️ App belum di-deploy (directory tidak ada)
- ⚠️ Warning: conflicting server name (ada config lain)

## 🔧 Step 1: Fix Nginx Conflict

```bash
# Check conflicting configs
cd /var/www/manufacturing-process-production-authenticity/nginx
chmod +x check-conflicts.sh
./check-conflicts.sh

# Atau check manual
grep -r "mpr.moof-set.web.id" /etc/nginx/sites-enabled/
```

Jika ada duplicate, disable yang lama:
```bash
sudo rm /etc/nginx/sites-enabled/old-config-name
sudo nginx -t
sudo systemctl reload nginx
```

## 🚀 Step 2: Deploy App

### Option A: Manual Deploy (Quick)

```bash
cd /var/www/manufacturing-process-production-authenticity

# Run manual deploy script
chmod +x .github/scripts/deploy-manual.sh
./.github/scripts/deploy-manual.sh
```

### Option B: Build & Deploy Manual

```bash
# 1. Build client
cd /var/www/manufacturing-process-production-authenticity/client
npm install
npm run build

# 2. Create deployment directory
mkdir -p ~/deployments/manufacturing-app
mkdir -p ~/deployments/manufacturing-app/server
mkdir -p ~/deployments/manufacturing-app/client-build

# 3. Copy files
cp -r ../server/* ~/deployments/manufacturing-app/server/
cp -r build/* ~/deployments/manufacturing-app/client-build/

# 4. Install server dependencies
cd ~/deployments/manufacturing-app/server
npm install --production

# 5. Start with PM2
mkdir -p logs
pm2 start ecosystem.config.js
# atau jika file tidak ada:
# pm2 start index.js --name manufacturing-app --instances max --exec-mode cluster
pm2 save
```

### Option C: Deploy via GitHub Actions

```bash
# Di local machine, push ke GitHub
git add .
git commit -m "Setup Nginx configuration"
git push origin main

# GitHub Actions akan otomatis deploy
# Monitor di: https://github.com/Bearson-norm/manufacturing-process-production-authenticity/actions
```

## ✅ Step 3: Verify

```bash
# Check PM2
pm2 status

# Test app
curl http://localhost:1234/health

# Test via Nginx
curl http://mpr.moof-set.web.id/api/health
curl http://mpr.moof-set.web.id
```

## 🔍 Troubleshooting

### App tidak start

```bash
# Check logs
pm2 logs manufacturing-app

# Check if port 1234 is in use
sudo lsof -i :1234

# Restart
pm2 restart manufacturing-app
```

### Nginx 502 Bad Gateway

```bash
# Check if app is running
pm2 status

# Check app logs
pm2 logs manufacturing-app

# Test app directly
curl http://localhost:1234/health
```

### Client build tidak ada

```bash
# Build client
cd /var/www/manufacturing-process-production-authenticity/client
npm install
npm run build

# Copy to deployment
cp -r build/* ~/deployments/manufacturing-app/client-build/
```

## 📝 Checklist

- [ ] Fix Nginx server name conflict
- [ ] Build client (npm run build)
- [ ] Create deployment directory
- [ ] Copy server files
- [ ] Copy client build
- [ ] Install server dependencies
- [ ] Start app with PM2
- [ ] Test app directly (port 1234)
- [ ] Test via Nginx
- [ ] Setup SSL (optional)

---

**Setelah deploy, app akan accessible di http://mpr.moof-set.web.id** 🎉

