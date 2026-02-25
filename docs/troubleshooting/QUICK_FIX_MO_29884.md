# Quick Fix - MO PROD/MO/29884 Tidak Muncul

## 🚀 Quick Steps (Copy-Paste)

### 1. Restart Server (Jika Belum)
```powershell
# Stop server (Ctrl+C jika running)
# Lalu start lagi
cd server
npm start
```

### 2. Trigger Manual Sync
```powershell
curl -X POST http://localhost:3000/api/admin/sync-mo
```

### 3. Tunggu 30-60 detik, lalu check:
```powershell
curl "http://localhost:3000/api/odoo/mo-list?productionType=cartridge" | ConvertFrom-Json | Select-Object -ExpandProperty data | Where-Object { $_.mo_number -eq "PROD/MO/29884" }
```

## ✨ Apa yang Sudah Diperbaiki

- ✅ Date range diperluas dari **7 hari** → **30 hari**
- ✅ Logging ditambahkan untuk tracking MO spesifik
- ✅ Debug endpoints ditambahkan
- ✅ Manual sync endpoint tersedia

## 🔍 Verifikasi

### Cek di Log Server
Setelah trigger sync, cari di log:
```
🎯 [Scheduler] Looking for MO: PROD/MO/29884 in the results...
✅ [Scheduler] Found PROD/MO/29884 in Odoo response!
```

### Cek via API
```powershell
# Cek status MO spesifik
curl "http://localhost:3000/api/odoo/debug/mo-sync?moNumber=PROD/MO/29884"

# Hasilnya harus: "moFound": true
```

## ❌ Jika Masih Tidak Ada

### Check 1: Apakah MO Ada di Odoo?
Login ke Odoo → Manufacturing → Manufacturing Orders → Cari PROD/MO/29884

### Check 2: Apakah Note Mengandung "cartridge"?
Di detail MO, cek field **Notes** harus mengandung kata "cartridge" (case-insensitive)

### Check 3: Kapan MO Dibuat?
Cek field **Creation Date**. Jika lebih dari 30 hari yang lalu, MO tidak akan muncul.

**Solusi**: Jika perlu extend lebih jauh, edit `server/index.js` line ~4331:
```javascript
const daysBack = 30; // Ubah jadi 60 atau lebih
```

### Check 4: Session Odoo Masih Valid?
Jika log menunjukkan error authentication:
1. Login ke Odoo di browser
2. Buka Developer Tools → Application → Cookies
3. Copy session_id yang baru
4. Update di admin config via API atau database

## 📞 Support Commands

```powershell
# Interactive debug
.\debug-mo.ps1

# Database debug
cd server
node debug-mo-sync.js

# Check sync status
curl "http://localhost:3000/api/odoo/debug/mo-sync"

# Check all cartridge MOs
curl "http://localhost:3000/api/odoo/mo-list?productionType=cartridge"
```

## 🎯 Expected Behavior Sekarang

Dengan date range 30 hari:
- **MO dibuat < 30 hari yang lalu** → ✅ Akan muncul
- **MO note mengandung "cartridge"** → ✅ Akan muncul
- **MO ada di Odoo** → ✅ Akan muncul

Jika ketiga kondisi terpenuhi, MO **PASTI** akan muncul setelah sync.
