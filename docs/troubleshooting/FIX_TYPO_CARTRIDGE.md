# Fix: Typo "CARTIRDGE" di Note Odoo

## 🐛 Masalah yang Ditemukan

MO **PROD/MO/29884** tidak muncul di mo-list karena:

```json
{
  "note": "TEAM CARTIRDGE - SHIFT 1",  // ← TYPO!
  "analysis": {
    "note_contains_cartridge": false,
    "would_pass_filter": false
  }
}
```

**Typo di Odoo:**
- ❌ Yang ada: `CART**I**RDGE` 
- ✅ Seharusnya: `CART**R**IDGE`

Filter mencari kata "**cartridge**" tapi note tertulis "**cartirdge**" (typo), sehingga tidak match.

## ✅ Solusi yang Diterapkan

### **Typo Tolerance di Filter**

Saya sudah update code untuk toleran terhadap typo umum:

**Typo yang di-support:**
1. ✅ `cartridge` (correct spelling)
2. ✅ `cartirdge` (typo: i instead of r, rd instead of dr)
3. ✅ `cartrige` (typo: missing d)

**Lokasi Update:**

#### 1. **Sync dari Odoo** (`updateMoDataFromOdoo`)
```javascript
// Odoo domain filter dengan OR condition
domainFilter = ['|', '|', 
  ['note', 'ilike', 'cartridge'],
  ['note', 'ilike', 'cartirdge'],  // Typo tolerance
  ['note', 'ilike', 'cartrige']
];
```

#### 2. **Endpoint mo-list** (`/api/odoo/mo-list`)
```javascript
// SQL query dengan OR condition
WHERE (LOWER(note) LIKE '%cartridge%' 
    OR LOWER(note) LIKE '%cartirdge%'
    OR LOWER(note) LIKE '%cartrige%')
```

#### 3. **Debug Endpoint** (`/api/odoo/debug/query-mo`)
```javascript
const hasCartridge = noteText.includes('cartridge') || 
                   noteText.includes('cartirdge') ||
                   noteText.includes('cartrige');
```

## 🚀 Cara Testing Setelah Fix

### 1. Restart Server
```powershell
# Stop server (Ctrl+C)
cd server
npm start
```

### 2. Trigger Sync Ulang
```powershell
curl -X POST http://localhost:3000/api/admin/sync-mo
```

### 3. Wait 30-60 seconds...

### 4. Verify dengan Debug Endpoint
```powershell
curl "http://localhost:3000/api/odoo/debug/query-mo?moNumber=PROD/MO/29884"
```

**Expected Response:**
```json
{
  "analysis": {
    "note_contains_cartridge": true,  // ← Now TRUE!
    "would_pass_filter": true
  }
}
```

### 5. Check MO List
```powershell
curl "http://localhost:3000/api/odoo/mo-list?productionType=cartridge"
```

**PROD/MO/29884 seharusnya muncul sekarang!** ✅

## 📊 Log yang Akan Muncul

```
🔍 [Scheduler] Querying Odoo for cartridge with filter: 
  ['|', '|', 
   ['note', 'ilike', 'cartridge'],
   ['note', 'ilike', 'cartirdge'],
   ['note', 'ilike', 'cartrige']
  ]
📋 [MO List] Querying cache for cartridge with patterns: cartridge, cartirdge, cartrige
```

## 💡 Rekomendasi Jangka Panjang

### **Opsi A: Fix Typo di Odoo (Recommended)**

Untuk data quality yang lebih baik, sebaiknya fix typo di Odoo:

1. **Manual Fix:**
   - Buka Manufacturing → Manufacturing Orders
   - Filter note yang mengandung "CARTIRDGE"
   - Update satu per satu menjadi "CARTRIDGE"

2. **Bulk Update (via SQL di Odoo database):**
   ```sql
   UPDATE mrp_production 
   SET note = REPLACE(note, 'CARTIRDGE', 'CARTRIDGE')
   WHERE note LIKE '%CARTIRDGE%';
   ```

3. **Prevention:**
   - Buat template note di Odoo
   - Atau gunakan dropdown/selection field
   - Training team untuk spelling yang benar

### **Opsi B: Keep Typo Tolerance (Current)**

- ✅ Pro: Fleksibel, toleran terhadap human error
- ❌ Con: Tidak fix root cause, data quality issue tetap ada

## 🔍 Check MO Lain yang Mungkin Typo

### Query untuk Check Typo di Odoo:
```powershell
# Via API (belum ada endpoint ini, bisa dibuat kalau perlu)
# Atau check manual di Odoo dengan search "CARTIRDGE"
```

### Pattern Typo yang Umum:
- `CARTIRDGE` (rd instead of dr)
- `CARTRIGE` (missing d)
- `CATRIDGE` (missing r)
- `CARTRIDIGE` (extra i)

## 📋 Summary

| Aspect | Before | After |
|--------|--------|-------|
| Filter | Hanya `cartridge` | `cartridge` OR `cartirdge` OR `cartrige` |
| PROD/MO/29884 | ❌ Tidak muncul | ✅ Akan muncul |
| Typo Tolerance | ❌ Tidak ada | ✅ Ada |
| Data Quality | - | ⚠️ Masih perlu fix di Odoo |

## 🎯 Action Items

### Immediate (Done ✅):
- [x] Update filter untuk typo tolerance
- [x] Update sync query
- [x] Update debug endpoint

### Next Steps (To Do 📝):
- [ ] Restart server
- [ ] Trigger manual sync
- [ ] Verify PROD/MO/29884 muncul
- [ ] (Optional) Fix typo di Odoo untuk data quality

### Long Term (Recommended 💡):
- [ ] Audit semua MO notes untuk typo
- [ ] Bulk update typo di Odoo
- [ ] Implement note template/dropdown di Odoo
- [ ] Training team untuk consistent spelling

## 🔧 Files Modified

1. `server/index.js`
   - `updateMoDataFromOdoo()` - Odoo domain filter
   - `/api/odoo/mo-list` - SQL query
   - `/api/odoo/debug/query-mo` - Analysis logic

2. `server/debug-mo-sync.js`
   - Query untuk check cartridge MOs

## 📞 Testing Commands

```powershell
# 1. Restart server
cd server
npm start

# 2. Sync
curl -X POST http://localhost:3000/api/admin/sync-mo

# 3. Wait 45 seconds
Start-Sleep -Seconds 45

# 4. Check specific MO
curl "http://localhost:3000/api/odoo/debug/query-mo?moNumber=PROD/MO/29884"

# 5. Check list
curl "http://localhost:3000/api/odoo/mo-list?productionType=cartridge"
```

## ✨ Result

Setelah fix ini, semua MO dengan note yang mengandung:
- ✅ "CARTRIDGE" (correct)
- ✅ "CARTIRDGE" (typo)
- ✅ "CARTRIGE" (typo)

Akan ter-capture dan muncul di mo-list! 🎉
