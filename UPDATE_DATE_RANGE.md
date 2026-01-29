# Update: Date Range Diperluas untuk MO Sync

## Perubahan yang Dilakukan

### 📅 Date Range Updates

#### 1. **Scheduler Sync dari Odoo** (`updateMoDataFromOdoo`)
- **Sebelumnya**: 7 hari
- **Sekarang**: **30 hari** ✨
- **Alasan**: Untuk memastikan semua MO recent tercapture, termasuk PROD/MO/29884

#### 2. **Endpoint mo-list** (`/api/odoo/mo-list`)
- **Sebelumnya**: 7 hari
- **Sekarang**: **30 hari** ✨
- **Impact**: Frontend akan menampilkan MO dari 30 hari terakhir

#### 3. **Cleanup Function** (`cleanupOldMoData`)
- **Sebelumnya**: 7 hari
- **Sekarang**: **60 hari** ✨
- **Alasan**: Menjaga data lebih lama untuk historical reference

### 📊 Enhanced Logging

Logging di scheduler sekarang menampilkan:
```
🔍 [Scheduler] Querying Odoo for cartridge with filter: ['note', 'ilike', 'cartridge']
📅 [Scheduler] Date range: From 2025-12-30 00:00:00 (30 days ago) to 2026-01-29 23:59:59
🎯 [Scheduler] Looking for MO: PROD/MO/29884 in the results...
📊 [Scheduler] Received 76 MO records from Odoo for cartridge
📋 [Scheduler] First 5 MOs: PROD/MO/29980, PROD/MO/29979, ...
📋 [Scheduler] Last 5 MOs: PROD/MO/29616, PROD/MO/29615, ...
✅ [Scheduler] Found PROD/MO/29884 in Odoo response!  <-- Akan muncul jika ada
⚠️  [Scheduler] PROD/MO/29884 NOT found in Odoo response  <-- Jika tidak ada
```

## Cara Testing

### 1. Restart Server
Server perlu di-restart untuk menerapkan perubahan:
```powershell
# Jika menggunakan npm
npm run dev

# Atau jika production
npm start
```

### 2. Trigger Manual Sync
Setelah server restart, trigger sync manual:
```powershell
curl -X POST http://localhost:3000/api/admin/sync-mo
```

### 3. Monitor Logs
Perhatikan log di console untuk melihat:
- Date range yang baru (30 days)
- Apakah PROD/MO/29884 ditemukan di Odoo response

### 4. Check Debug Endpoint
```powershell
curl "http://localhost:3000/api/odoo/debug/mo-sync?moNumber=PROD/MO/29884"
```

### 5. Verify mo-list API
```powershell
curl "http://localhost:3000/api/odoo/mo-list?productionType=cartridge"
```

## Expected Results

Dengan date range 30 hari, seharusnya:

### ✅ Jika MO Create Date < 30 hari yang lalu:
- MO akan muncul di sync Odoo
- MO akan tersimpan di cache
- MO akan muncul di endpoint mo-list
- Log akan menunjukkan: `✅ [Scheduler] Found PROD/MO/29884 in Odoo response!`

### ❌ Jika MO Masih Tidak Muncul:
Kemungkinan penyebab:
1. **MO tidak ada di Odoo** → Cek manual di Odoo
2. **MO note tidak ada "cartridge"** → Cek field note di Odoo
3. **MO create_date > 30 hari** → Perlu tambah date range lagi atau MO terlalu lama
4. **Session Odoo expired** → Update session_id di admin config

## File yang Dimodifikasi

1. ✅ `server/index.js`
   - Line ~4331: Sync scheduler date range (7 → 30 hari)
   - Line ~3880: mo-list endpoint date range (7 → 30 hari)
   - Line ~4520: Cleanup function date range (7 → 60 hari)
   - Line ~3970: Debug endpoint date range (7 → 30 hari)
   - Enhanced logging untuk tracking MO spesifik

2. ✅ `server/debug-mo-sync.js`
   - Updated query untuk 30 hari
   - Updated message untuk mencerminkan date range baru

3. ✅ `DEBUG_MO_SYNC.md`
   - Updated dokumentasi dengan date range baru

## Rollback (Jika Diperlukan)

Jika perlu kembali ke 7 hari, ubah:
```javascript
const daysBack = 30; // Ubah kembali ke 7
```

Dan untuk cleanup:
```javascript
const cleanupDaysBack = 60; // Ubah kembali ke 7
```

## Next Steps

1. **Restart server** untuk apply changes
2. **Trigger manual sync**: `POST /api/admin/sync-mo`
3. **Monitor logs** untuk melihat apakah MO 29884 muncul
4. **Check API** untuk verify data

## Notes

- Date range yang lebih lama akan mengambil lebih banyak data dari Odoo
- Database cache akan menyimpan lebih banyak MO
- Query akan sedikit lebih lambat tapi tidak signifikan
- Cleanup tetap berjalan otomatis untuk menjaga database tidak terlalu besar (60 hari)

## Monitoring

Untuk monitoring ke depan, gunakan:
```powershell
# Quick debug
.\debug-mo.ps1

# Database level
cd server && node debug-mo-sync.js

# API debug
curl "http://localhost:3000/api/odoo/debug/mo-sync"
```
