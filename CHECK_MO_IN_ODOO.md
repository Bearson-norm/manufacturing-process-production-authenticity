# Cara Check MO Langsung di Odoo

## 🎯 Endpoint Baru: Query MO Spesifik dari Odoo

Saya sudah menambahkan endpoint untuk query MO langsung dari Odoo **tanpa filter date**, sehingga kita bisa tahu pasti:

1. ✅ Apakah MO ada di Odoo?
2. ✅ Kapan create_date-nya?
3. ✅ Berapa hari umurnya?
4. ✅ Apakah note-nya mengandung "cartridge"?
5. ✅ Apakah akan pass filter 30 hari?

## 🚀 Cara Menggunakan

### Query MO PROD/MO/29884:

```powershell
curl "http://localhost:3000/api/odoo/debug/query-mo?moNumber=PROD/MO/29884"
```

### Contoh Response Jika MO Ditemukan:

```json
{
  "found": true,
  "mo_number": "PROD/MO/29884",
  "sku_name": "FOOM X CARTRIDGE (SFG 3 PCS)",
  "quantity": 1000,
  "uom": "Units",
  "note": "TEAM CARTRIDGE - SHIFT 1",
  "create_date": "2026-01-15T08:30:00.000Z",
  "state": "confirmed",
  "analysis": {
    "create_date_parsed": "2026-01-15T08:30:00.000Z",
    "days_old": "14.50",
    "within_30_days": true,
    "note_contains_cartridge": true,
    "would_pass_filter": true,
    "server_time": "2026-01-29T10:00:00.000Z"
  }
}
```

### Interpretasi:

#### ✅ `would_pass_filter: true`
**MO SEHARUSNYA MUNCUL!** 
- Umur < 30 hari ✓
- Note mengandung "cartridge" ✓

Jika `would_pass_filter: true` tapi MO tidak muncul di mo-list, kemungkinan:
- Scheduler belum sync → Trigger manual sync
- Cache database issue → Clear cache dan sync ulang

#### ❌ `would_pass_filter: false`

Cek detail di `analysis`:

**1. `within_30_days: false`**
```json
"days_old": "35.20"  // Lebih dari 30 hari
```
**Solusi**: 
- MO terlalu lama, ubah `daysBack` di code dari 30 ke 60 hari
- Atau ini memang expected behavior (data lama)

**2. `note_contains_cartridge: false`**
```json
"note": "TEAM DEVICE - SHIFT 1"  // Tidak ada kata "cartridge"
```
**Solusi**:
- Update note di Odoo, tambahkan kata "cartridge"
- Atau MO ini memang bukan untuk cartridge

## 🔍 Troubleshooting by Example

### Case 1: MO Ada, Umur < 30 Hari, Ada "cartridge", Tapi Tidak Muncul

```json
{
  "found": true,
  "analysis": {
    "days_old": "5.20",
    "within_30_days": true,
    "note_contains_cartridge": true,
    "would_pass_filter": true  // ✅ Seharusnya pass!
  }
}
```

**Diagnosis**: MO seharusnya muncul!

**Fix**:
1. Trigger manual sync:
   ```powershell
   curl -X POST http://localhost:3000/api/admin/sync-mo
   ```

2. Tunggu 30 detik, check cache:
   ```powershell
   curl "http://localhost:3000/api/odoo/debug/mo-sync?moNumber=PROD/MO/29884"
   ```

3. Check mo-list:
   ```powershell
   curl "http://localhost:3000/api/odoo/mo-list?productionType=cartridge"
   ```

### Case 2: MO Terlalu Lama

```json
{
  "found": true,
  "analysis": {
    "days_old": "45.80",
    "within_30_days": false,  // ❌
    "note_contains_cartridge": true,
    "would_pass_filter": false
  }
}
```

**Diagnosis**: MO sudah lebih dari 30 hari

**Fix**: Perluas date range ke 60 hari
1. Edit `server/index.js` line ~4331:
   ```javascript
   const daysBack = 60; // Ubah dari 30 ke 60
   ```

2. Restart server dan sync ulang

### Case 3: Note Tidak Mengandung "cartridge"

```json
{
  "found": true,
  "analysis": {
    "days_old": "5.20",
    "within_30_days": true,
    "note_contains_cartridge": false,  // ❌
    "would_pass_filter": false
  },
  "note": "PRODUCTION TEAM 1"
}
```

**Diagnosis**: Filter note tidak cocok

**Fix di Odoo**:
1. Buka MO di Odoo
2. Edit field "Notes"
3. Pastikan ada kata "cartridge" (case-insensitive OK)
4. Save
5. Trigger sync ulang

### Case 4: MO Tidak Ada di Odoo

```json
{
  "found": false,
  "message": "MO PROD/MO/29884 not found in Odoo"
}
```

**Diagnosis**: MO tidak ada atau belum dibuat

**Fix**:
- Cek manual di Odoo: Manufacturing → Manufacturing Orders
- Pastikan nomor MO benar (case-sensitive!)
- Jika MO ada tapi tidak ketemu, mungkin issue dengan Odoo API/session

## 📊 Enhanced Logging

Server logs sekarang menampilkan:

```
📅 [Scheduler] Server time: 2026-01-29T10:00:00.000Z
📅 [Scheduler] Date range: From 2025-12-30 00:00:00 (30 days ago) to 2026-01-29 23:59:59
📅 [Scheduler] Timezone: Asia/Jakarta
```

Ini membantu untuk:
- Memastikan server time benar
- Melihat exact date range yang digunakan
- Check timezone (penting untuk date calculation)

## 🎯 Workflow Debugging

```powershell
# 1. Query MO langsung dari Odoo
curl "http://localhost:3000/api/odoo/debug/query-mo?moNumber=PROD/MO/29884"

# 2. Lihat analysis, apakah would_pass_filter: true?

# 3a. Jika TRUE, trigger sync:
curl -X POST http://localhost:3000/api/admin/sync-mo

# 3b. Jika FALSE, lihat kenapa (days_old atau note)

# 4. Check di cache:
curl "http://localhost:3000/api/odoo/debug/mo-sync?moNumber=PROD/MO/29884"

# 5. Verify di mo-list:
curl "http://localhost:3000/api/odoo/mo-list?productionType=cartridge"
```

## 💡 Pro Tips

### Untuk Development:
Jika sering debug, buat alias di PowerShell:
```powershell
function Check-MO($mo) {
    curl "http://localhost:3000/api/odoo/debug/query-mo?moNumber=$mo" | ConvertFrom-Json
}

# Usage:
Check-MO "PROD/MO/29884"
```

### Untuk Production:
Monitor scheduler logs real-time:
```powershell
# Di terminal server, tail logs
Get-Content -Path "server.log" -Wait -Tail 50
```

## 🔧 Quick Actions

```powershell
# Check MO di Odoo
curl "http://localhost:3000/api/odoo/debug/query-mo?moNumber=PROD/MO/29884"

# Jika would_pass_filter: true, sync:
curl -X POST http://localhost:3000/api/admin/sync-mo

# Wait 30 seconds...
Start-Sleep -Seconds 30

# Verify
curl "http://localhost:3000/api/odoo/debug/mo-sync?moNumber=PROD/MO/29884"
```
