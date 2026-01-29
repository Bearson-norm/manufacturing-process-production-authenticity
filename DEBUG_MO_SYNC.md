# Debug MO Sync Issue - PROD/MO/29884 Tidak Muncul

## Masalah
MO `PROD/MO/29884` tidak muncul di endpoint `/api/odoo/mo-list?productionType=cartridge`

## Cara Debugging

### 1. Cek Status Sync via API Debug Endpoint

**Cek status sync umum:**
```bash
curl http://localhost:3000/api/odoo/debug/mo-sync
```

**Cek MO spesifik:**
```bash
curl "http://localhost:3000/api/odoo/debug/mo-sync?moNumber=PROD/MO/29884"
```

Response akan memberikan informasi:
- `lastSync`: Waktu terakhir sync dari Odoo
- `hoursSinceLastSync`: Berapa jam sejak sync terakhir
- `syncStatus`: Status sync (OK, OUTDATED, NEVER_SYNCED)
- `totalMosInCache`: Total MO di cache
- `moFound`: Apakah MO ditemukan di cache (jika query dengan moNumber)
- `mosByType`: Jumlah MO per tipe produksi

### 2. Manual Trigger Sync

Jika sync belum berjalan atau data outdated, trigger sync manual:

```bash
curl -X POST http://localhost:3000/api/admin/sync-mo
```

Ini akan memulai proses sync di background. Check server logs untuk melihat progress.

### 3. Debug Script (Langsung ke Database)

Jalankan debug script untuk memeriksa database:

```bash
cd server
node debug-mo-sync.js
```

Script ini akan memeriksa:
1. Apakah PROD/MO/29884 ada di cache
2. Semua MO cartridge dalam 7 hari terakhir
3. Total MO di cache
4. MO dengan nomor yang mirip (29883, 29884, 29885)
5. Waktu sync terakhir

### 4. Periksa Server Logs

Setelah trigger sync manual, periksa logs untuk melihat:

```
🔄 [Scheduler] Starting MO data update from Odoo...
🔍 [Scheduler] Querying Odoo for cartridge with filter: ['note', 'ilike', 'cartridge']
📅 [Scheduler] Date range: From 2026-01-22 00:00:00 to now
📥 [Scheduler] Odoo API response for cartridge: ...
📊 [Scheduler] Received X MO records from Odoo for cartridge
📋 [Scheduler] First 5 MOs: PROD/MO/29980, PROD/MO/29979, ...
📋 [Scheduler] Last 5 MOs: ...
✅ [Scheduler] Found PROD/MO/29884 in Odoo response!  <-- Jika ada
⚠️  [Scheduler] PROD/MO/29884 NOT found in Odoo response  <-- Jika tidak ada
```

## Kemungkinan Penyebab

### 1. MO Belum Di-Sync
- **Penyebab**: Scheduler berjalan setiap 6 jam, mungkin belum sempat sync
- **Solusi**: Trigger manual sync dengan endpoint POST `/api/admin/sync-mo`

### 2. MO Tidak Ada "cartridge" di Note
- **Penyebab**: Filter di Odoo mencari keyword "cartridge" di field `note`
- **Cek**: Lihat di Odoo apakah MO ini memiliki "cartridge" di note-nya
- **Solusi**: Update note di Odoo atau ubah filter di code

### 3. MO Create Date > 30 Hari
- **Penyebab**: System mengambil MO dari 30 hari terakhir
- **Cek**: Lihat `create_date` MO di Odoo
- **Note**: Date range sudah diperluas dari 7 hari menjadi 30 hari untuk coverage lebih baik

### 4. Session Odoo Expired
- **Penyebab**: Session ID untuk API Odoo sudah expire
- **Cek**: Logs akan menunjukkan error authentication
- **Solusi**: Update session ID di admin config

### 5. MO Tidak Ada di Odoo
- **Penyebab**: MO mungkin belum dibuat atau sudah dihapus
- **Cek**: Cari manual di Odoo
- **Solusi**: Buat MO jika belum ada

## Fix yang Sudah Dilakukan

1. ✅ Menambahkan endpoint debug: `GET /api/odoo/debug/mo-sync`
2. ✅ Menambahkan endpoint manual sync: `POST /api/admin/sync-mo`
3. ✅ Menambahkan logging detail untuk tracking MO spesifik
4. ✅ Membuat debug script: `server/debug-mo-sync.js`
5. ✅ **UPDATED**: Memperluas date range dari 7 hari menjadi 30 hari
   - Sync dari Odoo: 30 hari
   - Query mo-list: 30 hari
   - Cleanup: 60 hari (untuk menjaga data lebih lama)
6. ✅ Menambahkan logging date range dan target MO di scheduler

## Scheduler Schedule

Scheduler otomatis berjalan pada:
- **Update MO Data**: Setiap 6 jam (`0 */6 * * *`)
- **Cleanup Old Data**: Setiap hari jam 2 pagi (`0 2 * * *`)
- **Initial Sync**: 30 detik setelah server start

## Next Steps

1. Jalankan debug endpoint untuk cek status:
   ```bash
   curl "http://localhost:3000/api/odoo/debug/mo-sync?moNumber=PROD/MO/29884"
   ```

2. Jika MO tidak ditemukan (`moFound: false`), trigger manual sync:
   ```bash
   curl -X POST http://localhost:3000/api/admin/sync-mo
   ```

3. Monitor server logs untuk melihat apakah MO ada di response Odoo:
   - Jika ada: Masalah resolved setelah sync
   - Jika tidak ada: Cek di Odoo apakah MO ini ada dan memenuhi kriteria (note contains "cartridge", create_date < 7 hari)

4. Setelah sync, cek lagi endpoint mo-list:
   ```bash
   curl "http://localhost:3000/api/odoo/mo-list?productionType=cartridge"
   ```

## Kontak
Jika masih ada masalah setelah langkah-langkah di atas, periksa:
- Admin config di database (session_id, odooBaseUrl)
- Network connectivity ke Odoo server
- Odoo user permissions
