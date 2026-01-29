# Guide: MO Debug Postman Collection

## 📥 Import Collection

1. Buka Postman
2. Click **Import** button (kiri atas)
3. Drag & drop file `MO_Debug_API.postman_collection.json`
4. Collection akan muncul di sidebar

## 🔧 Setup Environment

### Local Development:
Collection sudah include environment variables:
- `base_url`: `http://localhost:3000`
- `mo_number`: `PROD/MO/29884`
- `production_type`: `cartridge`

### Untuk VPS/Production:
1. Edit environment variable `base_url` di Postman
2. Ubah ke: `https://your-domain.com` atau IP VPS

## 📋 Request List

### 1️⃣ Query MO dari Odoo (Direct)
**GET** `/api/odoo/debug/query-mo?moNumber=PROD/MO/29884`

**Kegunaan**: 
- Query MO langsung dari Odoo (tanpa filter date)
- Untuk verify apakah MO ada di Odoo
- Analisa apakah MO akan pass filter

**Response Example**:
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

**Key Fields**:
- `found`: MO ada di Odoo atau tidak
- `analysis.would_pass_filter`: **TRUE = seharusnya muncul di mo-list**
- `analysis.days_old`: Umur MO dalam hari
- `analysis.within_30_days`: Dalam range 30 hari?
- `analysis.note_contains_cartridge`: Note ada kata "cartridge"?

### 2️⃣ Get MO List by Type
**GET** `/api/odoo/mo-list?productionType=cartridge`

**Kegunaan**: 
- Mendapatkan list MO dari cache
- Data yang ditampilkan di frontend

**Response Example**:
```json
{
  "success": true,
  "count": 66,
  "data": [
    {
      "mo_number": "PROD/MO/29980",
      "sku_name": "FOOM X CARTRIDGE (SFG 3 PCS)",
      "quantity": 1000,
      "uom": "Units",
      "create_date": "2026-01-28T02:42:33.000Z",
      "note": "TEAM CARTRIDGE - SHIFT 1"
    }
  ]
}
```

### 3️⃣ Check MO in Cache
**GET** `/api/odoo/debug/mo-sync?moNumber=PROD/MO/29884`

**Kegunaan**: 
- Check apakah MO sudah ada di cache database
- Verify sync berhasil

**Response Example**:
```json
{
  "timestamp": "2026-01-29T10:00:00.000Z",
  "moNumber": "PROD/MO/29884",
  "lastSync": "2026-01-29T09:45:00.000Z",
  "totalMosInCache": 323,
  "hoursSinceLastSync": "0.25",
  "syncStatus": "OK",
  "moFound": true,
  "moData": {
    "mo_number": "PROD/MO/29884",
    "sku_name": "FOOM X CARTRIDGE (SFG 3 PCS)",
    "quantity": 1000,
    "create_date": "2026-01-15T08:30:00.000Z",
    "fetched_at": "2026-01-29T09:45:00.000Z"
  }
}
```

**Key Fields**:
- `moFound`: true = MO ada di cache
- `syncStatus`: OK / OUTDATED / NEVER_SYNCED
- `hoursSinceLastSync`: Durasi sejak sync terakhir

### 4️⃣ Trigger Manual Sync
**POST** `/api/admin/sync-mo`

**Kegunaan**: 
- Trigger sync manual dari Odoo ke cache
- Berguna jika scheduler belum berjalan atau data outdated

**Response**:
```json
{
  "success": true,
  "message": "MO sync started. Check server logs for progress.",
  "timestamp": "2026-01-29T10:00:00.000Z"
}
```

**Note**: 
- Proses berjalan di background
- Tunggu 30-60 detik sebelum check cache
- Monitor server logs untuk melihat progress

### 5️⃣ Check Sync Status
**GET** `/api/odoo/debug/mo-sync`

**Kegunaan**: 
- Check status sync umum
- Statistik MO di cache

**Response Example**:
```json
{
  "timestamp": "2026-01-29T10:00:00.000Z",
  "moNumber": "all",
  "lastSync": "2026-01-29T09:45:00.000Z",
  "totalMosInCache": 323,
  "hoursSinceLastSync": "0.25",
  "syncStatus": "OK",
  "mosByType": [
    {
      "production_type": "cartridge",
      "count": 76
    },
    {
      "production_type": "liquid",
      "count": 221
    },
    {
      "production_type": "device",
      "count": 26
    }
  ]
}
```

### 6️⃣-8️⃣ Get All MOs by Type

**GET** `/api/odoo/mo-list?productionType={cartridge|liquid|device}`

Pre-configured untuk semua 3 production types.

## 🎯 Workflow Debugging

### Scenario 1: MO Tidak Muncul di Frontend

1. **Query MO dari Odoo** (Request #1)
   ```
   GET /api/odoo/debug/query-mo?moNumber=PROD/MO/29884
   ```
   - Cek: `found = true`?
   - Cek: `would_pass_filter = true`?

2. **Check di Cache** (Request #3)
   ```
   GET /api/odoo/debug/mo-sync?moNumber=PROD/MO/29884
   ```
   - Cek: `moFound = true`?

3. **Jika MO tidak di cache, Trigger Sync** (Request #4)
   ```
   POST /api/admin/sync-mo
   ```
   Tunggu 30-60 detik...

4. **Re-check Cache** (Request #3 lagi)
   ```
   GET /api/odoo/debug/mo-sync?moNumber=PROD/MO/29884
   ```

5. **Verify di MO List** (Request #2)
   ```
   GET /api/odoo/mo-list?productionType=cartridge
   ```

### Scenario 2: Check Status Sync

1. **Check Sync Status** (Request #5)
   ```
   GET /api/odoo/debug/mo-sync
   ```

2. **Jika OUTDATED, Trigger Sync** (Request #4)
   ```
   POST /api/admin/sync-mo
   ```

### Scenario 3: Monitoring Regular

1. **Get MO List** (Request #6/7/8)
   ```
   GET /api/odoo/mo-list?productionType=cartridge
   ```

2. **Check Sync Status** (Request #5)
   ```
   GET /api/odoo/debug/mo-sync
   ```

## 💡 Tips

### 1. Edit Variable untuk Testing
Di Postman, klik environment variables (kanan atas):
- `mo_number`: Ganti dengan MO yang ingin dicari
- `production_type`: Ganti dengan `cartridge`, `liquid`, atau `device`
- `base_url`: Ganti dengan URL VPS jika testing production

### 2. Save Responses
Click **Save Response** untuk menyimpan response sebagai example documentation

### 3. Create Tests
Tambahkan test script di tab **Tests**:

```javascript
// Test untuk request #1 (Query MO)
pm.test("MO Found in Odoo", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData.found).to.eql(true);
});

pm.test("MO Would Pass Filter", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData.analysis.would_pass_filter).to.eql(true);
});
```

### 4. Run Collection
1. Click **Runner** di Postman
2. Select collection
3. Click **Run** untuk run semua requests sekaligus

## 🔗 Related Files

- `debug-mo-odoo.ps1` - PowerShell script (interactive)
- `CHECK_MO_IN_ODOO.md` - Detailed documentation
- `DEBUG_MO_SYNC.md` - General debugging guide
- `QUICK_FIX_MO_29884.md` - Quick reference

## 📞 API Documentation Summary

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/odoo/debug/query-mo` | GET | Query MO langsung dari Odoo |
| `/api/odoo/mo-list` | GET | Get MO list dari cache |
| `/api/odoo/debug/mo-sync` | GET | Check MO di cache / sync status |
| `/api/admin/sync-mo` | POST | Trigger manual sync |

## ⚙️ Environment Variables

```json
{
  "base_url": "http://localhost:3000",
  "mo_number": "PROD/MO/29884",
  "production_type": "cartridge"
}
```

## 🚀 Quick Start

1. Import collection ke Postman
2. Send request #1 untuk check MO di Odoo
3. Jika `would_pass_filter: true`, send request #4 untuk sync
4. Send request #2 untuk verify MO muncul di list

Done! 🎉
