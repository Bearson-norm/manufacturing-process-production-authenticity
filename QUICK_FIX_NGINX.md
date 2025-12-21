# 🔧 Quick Fix - Nginx Setup & App Deployment

## ⚠️ Issues Found

1. ✅ Nginx config valid (warning about conflicting server name)
2. ❌ App belum di-deploy (directory tidak ada)
3. ⚠️ Conflicting server name (ada config lain untuk domain yang sama)

## 🚀 Quick Solution

### Step 1: Fix Nginx Conflict

```bash
# Check apa yang conflict
cd /var/www/manufacturing-process-production-authenticity/nginx
chmod +x check-conflicts.sh
./check-conflicts.sh

# Atau check manual
grep -r "mpr.moof-set.web.id" /etc/nginx/sites-enabled/
```

Jika ada duplicate, disable yang lama:
```bash
# List enabled sites
ls -la /etc/nginx/sites-enabled/

# Remove duplicate (ganti 'old-config' dengan nama file yang conflict)
sudo rm /etc/nginx/sites-enabled/old-config-name

# Test dan reload
sudo nginx -t
sudo systemctl reload nginx
```

### Step 2: Deploy App (Pilih salah satu)

#### Option A: Manual Deploy Script (Recommended)

```bash
cd /var/www/manufacturing-process-production-authenticity
chmod +x .github/scripts/deploy-manual.sh
./.github/scripts/deploy-manual.sh
```

#### Option B: Quick Manual Deploy

```bash
# 1. Build client
cd /var/www/manufacturing-process-production-authenticity/client
npm install
npm run build

# 2. Create directories
mkdir -p ~/deployments/manufacturing-app/{server,client-build}

# 3. Copy files
cp -r server/* ~/deployments/manufacturing-app/server/
cp -r client/build/* ~/deployments/manufacturing-app/client-build/

# 4. Install & start
cd ~/deployments/manufacturing-app/server
npm install --production
mkdir -p logs

# 5. Start with PM2
pm2 start ecosystem.config.js || pm2 start index.js --name manufacturing-app --instances max --exec-mode cluster
pm2 save
```

#### Option C: Deploy via GitHub Actions

```bash
# Di local machine
git add .
git commit -m "Setup Nginx and deployment"
git push origin main

# Monitor deployment di GitHub Actions
```

### Step 3: Verify

```bash
# Check PM2
pm2 status

# Test app
curl http://localhost:1234/health

# Test via Nginx
curl http://mpr.moof-set.web.id/api/health
```

## 📋 Complete Command Sequence

```bash
# Fix Nginx conflict
cd /var/www/manufacturing-process-production-authenticity/nginx
./check-conflicts.sh
# Remove duplicate config if found
sudo nginx -t && sudo systemctl reload nginx

# Deploy app
cd /var/www/manufacturing-process-production-authenticity
./.github/scripts/deploy-manual.sh

# Verify
pm2 status
curl http://localhost:1234/health
curl http://mpr.moof-set.web.id/api/health
```

## 🐛 Troubleshooting

### Nginx conflict masih ada

```bash
# Check all configs
sudo nginx -T | grep -A 5 "server_name.*mpr.moof-set.web.id"

# Disable all except manufacturing-app
sudo rm /etc/nginx/sites-enabled/*-app  # Remove other app configs
sudo ln -s /etc/nginx/sites-available/manufacturing-app /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### App tidak start

```bash
# Check logs
pm2 logs manufacturing-app

# Check if port in use
sudo lsof -i :1234

# Restart
pm2 restart manufacturing-app
```

### Client build error

```bash
# Check Node version
node --version  # Should be 14+ or 18+

# Clean install
cd /var/www/manufacturing-process-production-authenticity/client
rm -rf node_modules package-lock.json
npm install
npm run build
```

---

**Setelah selesai, app akan accessible di http://mpr.moof-set.web.id** ✅

