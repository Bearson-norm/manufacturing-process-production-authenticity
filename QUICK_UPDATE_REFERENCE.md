# ⚡ Quick Update Reference Card

Panduan cepat untuk update sistem Manufacturing Process Production Authenticity di VPS.

## 🚀 Update via CI/CD (Recommended - 5 menit)

```bash
# Di local machine
git add .
git commit -m "Update: description"
git push origin main

# Monitor deployment
# https://github.com/Bearson-norm/manufacturing-process-production-authenticity/actions
```

**Setelah deployment selesai:**
```bash
ssh foom@103.31.39.189
pm2 status
curl http://localhost:1234/health
```

---

## 🔧 Update Manual (15-30 menit)

### Step 1: Backup
```bash
ssh foom@103.31.39.189
cd ~
chmod +x backup-before-update.sh
./backup-before-update.sh
```

### Step 2: Pull & Build
```bash
cd /var/www/manufacturing-process-production-authenticity
git pull origin main
cd client && npm install && npm run build && cd ..
cd server && npm install --production && cd ..
```

### Step 3: Deploy
```bash
# Gunakan script deploy jika ada
chmod +x .github/scripts/deploy-manual.sh
sudo ./.github/scripts/deploy-manual.sh

# Atau manual:
cd ~/deployments
mv manufacturing-app manufacturing-app-backup-$(date +%Y%m%d-%H%M%S)
mkdir -p manufacturing-app/server manufacturing-app/client-build
cp -r /var/www/manufacturing-process-production-authenticity/server/* manufacturing-app/server/
cp -r /var/www/manufacturing-process-production-authenticity/client/build/* manufacturing-app/client-build/
cp manufacturing-app-backup-*/server/database.sqlite manufacturing-app/server/ 2>/dev/null || true
cp manufacturing-app-backup-*/server/.env manufacturing-app/server/ 2>/dev/null || true
cd manufacturing-app/server && npm install --production && cd ../..
```

### Step 4: Restart
```bash
pm2 delete manufacturing-app || true
cd ~/deployments/manufacturing-app/server
pm2 start ecosystem.config.js || pm2 start index.js --name manufacturing-app --instances max --exec-mode cluster
pm2 save
```

### Step 5: Verify
```bash
pm2 status
pm2 logs manufacturing-app --lines 20
curl http://localhost:1234/health
```

---

## ⏪ Rollback (Emergency)

```bash
pm2 delete manufacturing-app
cd ~/deployments
LATEST_BACKUP=$(ls -dt manufacturing-app-backup-* | head -1)
rm -rf manufacturing-app
mv $LATEST_BACKUP manufacturing-app
cd manufacturing-app/server
pm2 start ecosystem.config.js || pm2 start index.js --name manufacturing-app --instances max --exec-mode cluster
pm2 save
pm2 status
curl http://localhost:1234/health
```

---

## ✅ Quick Verification

```bash
# 1. PM2 Status
pm2 status
# Harus: manufacturing-app | online

# 2. Health Check
curl http://localhost:1234/health
# Harus: {"status":"healthy","database":"connected"}

# 3. New Endpoint
curl "http://localhost:1234/api/external/manufacturing-data/status?mo_number=PROD/MO/28246&completed_at=all"
# Harus: {"status":"active"} atau {"status":"completed"}

# 4. Via Nginx
curl -k https://mpr.moof-set.web.id/api/health
```

---

## 🐛 Quick Fix

```bash
# App tidak start?
pm2 logs manufacturing-app --err

# Port conflict?
sudo lsof -i :1234
sudo kill -9 <PID>

# Dependencies error?
cd ~/deployments/manufacturing-app/server
rm -rf node_modules package-lock.json
npm install --production
pm2 restart manufacturing-app

# Database locked?
pm2 stop all
rm -f ~/deployments/manufacturing-app/server/database.sqlite-wal
rm -f ~/deployments/manufacturing-app/server/database.sqlite-shm
pm2 start all
```

---

## 📋 Pre-Update Checklist

- [ ] Backup database
- [ ] Backup deployment folder
- [ ] Test di local
- [ ] Tentukan maintenance window
- [ ] Informasikan user

---

## 📋 Post-Update Checklist

- [ ] PM2 status: online
- [ ] Health endpoint: OK
- [ ] New endpoint: OK
- [ ] Frontend: OK
- [ ] Admin panel: OK
- [ ] External API config: OK

---

## 📚 Full Documentation

- **Update Guide**: `VPS_UPDATE_GUIDE.md`
- **Update Summary**: `UPDATE_SUMMARY.md`
- **Production Checklist**: `PRODUCTION_CHECKLIST.md`
- **Troubleshooting**: `TROUBLESHOOTING.md`

---

**⏱️ Estimated Time:**
- CI/CD: 5-10 menit
- Manual: 15-30 menit

**🔄 Rollback Time:** 2-5 menit

