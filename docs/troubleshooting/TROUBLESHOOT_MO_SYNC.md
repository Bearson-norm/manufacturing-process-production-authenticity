# Troubleshooting MO Sync dari Odoo

## Masalah: Tidak Ada Data di odoo_mo_cache

Jika tabel `odoo_mo_cache` kosong, berikut langkah-langkah untuk mengatasi:

## 1. Verifikasi Konfigurasi Odoo

### Cek Admin Configuration

1. Buka Admin Panel: `http://localhost:1234/admin`
2. Pastikan sudah diisi:
   - **Odoo Session ID** (minimal 20 karakter)
   - **Odoo Base URL** (contoh: `https://foomx.odoo.com`)

3. Klik **"Save Configuration"**

### Test Koneksi Odoo

Gunakan endpoint test connection:
```bash
curl http://localhost:1234/api/admin/test-connection
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Connection test successful",
  "odooBaseUrl": "https://foomx.odoo.com",
  "sessionIdConfigured": true
}
```

## 2. Manual Sync MO (Cara Cepat)

### Menggunakan cURL

```bash
curl -X POST http://localhost:1234/api/admin/sync-mo
```

### Menggunakan PowerShell

```powershell
Invoke-RestMethod -Uri "http://localhost:1234/api/admin/sync-mo" -Method POST
```

### Menggunakan Postman

1. Method: `POST`
2. URL: `http://localhost:1234/api/admin/sync-mo`
3. Send

**Expected Response:**
```json
{
  "success": true,
  "message": "MO sync completed successfully",
  "totalUpdated": 150,
  "results": [
    {
      "production_type": "liquid",
      "updated": 50,
      "status": "success"
    },
    {
      "production_type": "device",
      "updated": 60,
      "status": "success"
    },
    {
      "production_type": "cartridge",
      "updated": 40,
      "status": "success"
    }
  ],
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## 3. Cek Scheduler

### Apakah Scheduler Berjalan?

Scheduler otomatis berjalan setiap 6 jam:
- **00:00, 06:00, 12:00, 18:00** (WIB)

Cek log server untuk melihat:
```
⏰ [Scheduler] Triggered: Update MO data from Odoo
🔄 [Scheduler] Starting MO data update from Odoo...
```

### Initial Sync saat Server Start

Saat server start, akan ada initial sync setelah 5 detik:
```
🔄 [Initial Sync] Will start initial MO sync in 5 seconds...
🔄 [Initial Sync] Starting initial MO sync from Odoo...
```

## 4. Verifikasi Data

### Cek MO Stats

```bash
curl http://localhost:1234/api/admin/mo-stats
```

**Expected Response:**
```json
{
  "success": true,
  "stats": {
    "total": 1325,
    "recent_24h": 50,
    "older_than_7_days": 1200
  }
}
```

### Cek Data di Database

```bash
cd server
node check-database.js
```

Atau query langsung:
```sql
SELECT COUNT(*) FROM odoo_mo_cache;
SELECT * FROM odoo_mo_cache ORDER BY fetched_at DESC LIMIT 10;
```

## 5. Troubleshooting Error

### Error: "Odoo configuration is missing"

**Penyebab:** Session ID atau Base URL belum di-set

**Solusi:**
1. Buka Admin Panel
2. Isi Odoo Session ID dan Base URL
3. Save Configuration
4. Coba sync lagi

### Error: "Request timeout"

**Penyebab:** Koneksi ke Odoo lambat atau terputus

**Solusi:**
- Cek koneksi internet
- Pastikan Odoo API dapat diakses
- Cek firewall/proxy settings

### Error: "Odoo API error" atau "Session expired"

**Penyebab:** Session ID sudah expired

**Solusi:**
1. Login ke Odoo
2. Ambil Session ID baru dari browser cookies
3. Update di Admin Panel
4. Save Configuration
5. Coba sync lagi

### Error: "Failed to parse Odoo response"

**Penyebab:** Response dari Odoo tidak valid

**Solusi:**
- Cek log server untuk detail error
- Pastikan Odoo Base URL benar
- Cek apakah Odoo API sedang maintenance

### Tidak Ada Data yang Di-sync

**Kemungkinan:**
1. **Tidak ada MO dalam 30 hari terakhir**
   - Cek di Odoo apakah ada MO baru
   - Cek filter production type (liquid/device/cartridge)

2. **Filter tidak match**
   - MO harus memiliki note yang mengandung "liquid", "device", atau "cartridge"
   - Cek di Odoo apakah MO memiliki note yang sesuai

3. **Date range terlalu sempit**
   - Default: 30 hari terakhir
   - Jika perlu lebih lama, modifikasi script

## 6. Cek Log Server

Perhatikan log di console saat sync berjalan:

**Success:**
```
🔄 [Scheduler] Starting MO data update from Odoo...
📊 [Scheduler] Received 50 MO records from Odoo for liquid
✅ [Scheduler] Updated 50 MO records for liquid
✅ [Scheduler] MO data update completed. Total updated: 150
```

**Error:**
```
❌ [Scheduler] Error getting admin config: ...
❌ [Scheduler] Error updating MO data for liquid: ...
```

## 7. Manual Test Step-by-Step

### Step 1: Cek Konfigurasi
```bash
curl http://localhost:1234/api/admin/config
```

### Step 2: Test Koneksi
```bash
curl http://localhost:1234/api/admin/test-connection
```

### Step 3: Manual Sync
```bash
curl -X POST http://localhost:1234/api/admin/sync-mo
```

### Step 4: Verifikasi Data
```bash
curl http://localhost:1234/api/admin/mo-stats
```

## 8. Force Re-sync

Jika perlu menghapus cache lama dan sync ulang:

```sql
-- Hapus semua data cache
TRUNCATE TABLE odoo_mo_cache;

-- Lalu trigger manual sync
```

Atau via API:
```bash
# 1. Hapus data (via SQL atau Admin Panel)
# 2. Manual sync
curl -X POST http://localhost:1234/api/admin/sync-mo
```

## 9. Monitoring

### Cek Last Sync Time

```sql
SELECT MAX(fetched_at) as last_sync FROM odoo_mo_cache;
```

### Cek Sync Frequency

Scheduler berjalan setiap 6 jam. Untuk cek kapan terakhir sync:
```sql
SELECT 
  production_type,
  COUNT(*) as count,
  MAX(fetched_at) as last_sync
FROM odoo_mo_cache
GROUP BY production_type;
```

## 10. Tips

1. **Selalu test connection dulu** sebelum sync
2. **Gunakan manual sync** untuk testing atau urgent update
3. **Monitor log server** untuk melihat progress sync
4. **Cek MO stats** setelah sync untuk verifikasi
5. **Pastikan Session ID masih valid** (bisa expired)

## Quick Fix Checklist

- [ ] Odoo Session ID sudah di-set di Admin Panel
- [ ] Odoo Base URL sudah benar
- [ ] Test connection berhasil
- [ ] Manual sync berhasil
- [ ] Data muncul di odoo_mo_cache
- [ ] MO stats menunjukkan data

Jika semua checklist sudah, tapi masih tidak ada data, cek:
- Apakah ada MO di Odoo dengan note yang sesuai?
- Apakah MO dalam range 30 hari terakhir?
- Apakah ada error di log server?
