# ⚡ Quick Deploy Reference Card

## 🎯 Cara Cepat Deploy ke VPS

### Opsi 1: Menggunakan Script Otomatis (RECOMMENDED)

```bash
# Di komputer lokal (Windows)
bash deploy-to-vps.sh
```

**Keunggulan:**
- Otomatis backup database
- Otomatis pull, install, build, restart
- Menampilkan status dan logs
- Aman dengan error handling

---

### Opsi 2: Manual Step-by-Step

**1. SSH ke VPS**
```bash
ssh foom@103.31.39.189
```

**2. Backup & Update**
```bash
cd ~/deployments/manufacturing-app
cp server/database.sqlite server/database.sqlite.backup-$(date +%Y%m%d-%H%M%S)
pm2 stop manufacturing-backend
git pull origin main
```

**3. Install & Build**
```bash
cd server && npm install && cd ..
cd client && npm install && npm run build && cd ..
```

**4. Restart**
```bash
pm2 restart manufacturing-backend
pm2 logs manufacturing-backend --lines 20
```

---

## 🔍 Quick Check Commands

### Check Status
```bash
ssh foom@103.31.39.189 "pm2 status"
```

### Check Logs
```bash
ssh foom@103.31.39.189 "pm2 logs manufacturing-backend --lines 50"
```

### Monitor Real-time
```bash
ssh foom@103.31.39.189 "pm2 monit"
```

---

## 🌐 Test URLs After Deploy

| Feature | URL |
|---------|-----|
| Dashboard | http://103.31.39.189 |
| Manufacturing Report | http://103.31.39.189/report-dashboard |
| Production Chart | http://103.31.39.189/production-chart |
| Admin Panel (PIC Management) | http://103.31.39.189/admin |

---

## 🆘 Emergency Rollback

```bash
ssh foom@103.31.39.189
cd ~/deployments/manufacturing-app
pm2 stop manufacturing-backend
git log --oneline  # Lihat commit sebelumnya
git checkout beae0b9  # Commit hash sebelum update
cd client && npm install && npm run build && cd ..
pm2 restart manufacturing-backend
```

---

## 📝 Post-Deploy Checklist

- [ ] Dashboard utama bisa diakses
- [ ] Card "Laporan Manufacturing" muncul
- [ ] Card "Grafik Statistik Produksi" muncul
- [ ] Manufacturing Report menampilkan data MO
- [ ] Production Chart menampilkan grafik
- [ ] PIC dropdown muncul di form input
- [ ] Admin panel bisa manage PIC
- [ ] Barcode scanner auto-advance berfungsi
- [ ] Perhitungan authenticity benar (last - first)

---

## 💾 Important Files

| File | Purpose |
|------|---------|
| `DEPLOYMENT_GUIDE_UPDATE.md` | Panduan lengkap deployment |
| `deploy-to-vps.sh` | Script otomatis deployment |
| `VPS_UPDATE_GUIDE.md` | Panduan update sistem |
| `QUICK_DEPLOY.md` | Quick reference (file ini) |

---

## 📞 Troubleshooting Quick Fixes

### Chart tidak muncul
```bash
ssh foom@103.31.39.189
cd ~/deployments/manufacturing-app/client
npm install chart.js react-chartjs-2
npm run build
```

### Backend error
```bash
ssh foom@103.31.39.189
cd ~/deployments/manufacturing-app/server
pm2 logs manufacturing-backend --lines 100
pm2 restart manufacturing-backend
```

### Database error
```bash
ssh foom@103.31.39.189
cd ~/deployments/manufacturing-app/server
ls -lh database.sqlite*  # Check backups
# Restore if needed:
# cp database.sqlite.backup-YYYYMMDD-HHMMSS database.sqlite
```

---

**Last Updated:** January 7, 2026  
**Version:** 2.0 (Manufacturing Report + Production Chart + PIC Management)
