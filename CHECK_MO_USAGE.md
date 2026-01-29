# MO Tidak Muncul di Dropdown - MO Sudah Pernah Di-Input

## 🔍 **Masalah:**

MO **PROD/MO/29884** sudah ada di API (`/api/odoo/mo-list`) tapi **tidak muncul di dropdown** form input.

## ✅ **Root Cause:**

Frontend **sengaja memfilter MO yang sudah pernah di-input** untuk mencegah duplicate entry:

```javascript
// ProductionLiquid.js line 261-276
const usedMoNumbers = new Set();
savedData.forEach(session => {
  session.inputs.forEach(input => {
    usedMoNumbers.add(input.mo_number); // Collect used MOs
  });
});

// Filter out MO numbers that have already been used
if (usedMoNumbers.has(mo.mo_number)) {
  return false; // ← MO tidak muncul!
}
```

**Ini adalah FEATURE bukan bug** - untuk mencegah input MO yang sama dua kali.

## 🎯 **Check Apakah MO Sudah Pernah Di-input:**

### Endpoint Baru:
```powershell
# PowerShell
$url = "http://localhost:3000/api/production/check-mo-used?moNumber=PROD/MO/29884&productionType=liquid"
curl $url

# Atau CMD
curl "http://localhost:3000/api/production/check-mo-used?moNumber=PROD/MO/29884&productionType=liquid"
```

**Response jika sudah pernah di-input:**
```json
{
  "used": true,
  "count": 2,
  "activeCount": 0,
  "completedCount": 2,
  "records": [
    {
      "id": 123,
      "session_id": "...",
      "status": "completed",
      "created_at": "2026-01-25T10:00:00.000Z"
    }
  ],
  "message": "MO PROD/MO/29884 telah digunakan 2 kali (0 active, 2 completed)"
}
```

**Response jika belum pernah di-input:**
```json
{
  "used": false,
  "count": 0,
  "message": "MO PROD/MO/29884 belum pernah digunakan"
}
```

## ✅ **Solusi:**

### **Opsi 1: MO Memang Sudah Pernah Di-input (Expected Behavior)**

Jika MO ini sudah pernah di-input dan completed, **ini adalah expected behavior**.

**Alasan:**
- Mencegah duplicate entry
- Setiap MO seharusnya hanya di-input sekali
- Jika perlu input lagi, berarti ada batch/shift baru → seharusnya MO number baru juga

**Action:** Tidak perlu di-fix, sistem bekerja dengan benar.

### **Opsi 2: Ingin Input MO yang Sama Lagi (Batch Baru)**

Jika memang perlu input MO yang sama untuk batch/shift berbeda:

#### **Solusi A: Hapus/Archive Data Lama**

Jika data lama sudah tidak terpakai:
```sql
-- Update status jadi archived (jangan delete untuk audit trail)
UPDATE production_liquid 
SET status = 'archived' 
WHERE mo_number = 'PROD/MO/29884';
```

Atau via API (bisa dibuat endpoint baru kalau perlu):
```powershell
curl -X POST "http://localhost:3000/api/production/archive-mo" \
  -H "Content-Type: application/json" \
  -d '{"moNumber": "PROD/MO/29884", "productionType": "liquid"}'
```

#### **Solusi B: Ubah Filter Frontend (Allow Completed MOs)**

Edit `client/src/components/ProductionLiquid.js` line 269-278:

**Sebelum:**
```javascript
// Exclude MO numbers that have already been used
if (usedMoNumbers.has(mo.mo_number)) {
  return false;
}
```

**Sesudah:**
```javascript
// Only exclude MO numbers that are ACTIVE (allow completed MOs)
const activeMoNumbers = new Set();
savedData.forEach(session => {
  session.inputs.forEach(input => {
    if (input.status === 'active') {
      activeMoNumbers.add(input.mo_number);
    }
  });
});

// Only filter out active MOs
if (activeMoNumbers.has(mo.mo_number)) {
  return false;
}
```

Dengan perubahan ini:
- ✅ MO yang sudah completed bisa di-input lagi
- ✅ MO yang sedang active tidak bisa di-input (prevent conflict)

#### **Solusi C: Force Refresh Frontend**

Kadang frontend cache stuck:

1. **Hard Refresh Browser:**
   - Chrome/Edge: `Ctrl + Shift + R`
   - Firefox: `Ctrl + F5`

2. **Clear State dan Reload:**
   - Buka DevTools (F12)
   - Application → Local Storage → Clear
   - Refresh page

### **Opsi 3: Type Cartridge bukan Liquid**

Saya notice MO ini untuk **CARTRIDGE** bukan liquid!

```json
{
  "sku_name": "FOOM X CARTRIDGE PACK (3PCS)",
  "note": "TEAM CARTIRDGE - SHIFT 1"
}
```

Tapi component yang dibuka adalah **ProductionLiquid.js** yang query:
```javascript
params: { productionType: 'liquid' } // ← Salah!
```

**Solusi:**
- Buka component **ProductionCartridge** bukan ProductionLiquid
- Atau pastikan query ke endpoint yang benar

## 🚀 **Quick Check:**

```powershell
# 1. Check apakah MO sudah pernah di-input
curl "http://localhost:3000/api/production/check-mo-used?moNumber=PROD/MO/29884&productionType=liquid"

# 2. Check di cartridge juga (karena SKU-nya cartridge)
curl "http://localhost:3000/api/production/check-mo-used?moNumber=PROD/MO/29884&productionType=cartridge"

# 3. Check API mo-list untuk cartridge
curl "http://localhost:3000/api/odoo/mo-list?productionType=cartridge"
```

## 📊 **Diagnosis Tree:**

```
MO tidak muncul di dropdown
├─ Check: Apakah sudah di API mo-list?
│  ├─ Tidak → Fix sync (sudah done ✅)
│  └─ Ya → Lanjut check
│
├─ Check: Apakah MO sudah pernah di-input?
│  ├─ Ya, status=active → Expected (sedang dipakai)
│  ├─ Ya, status=completed → Option: Allow completed MOs
│  └─ Tidak → Check type mismatch
│
└─ Check: Apakah production type cocok?
   ├─ MO untuk cartridge tapi buka liquid form → Buka form yang benar
   └─ Type cocok → Frontend cache issue, hard refresh
```

## 💡 **Recommended Action:**

1. **Check usage:**
   ```powershell
   curl "http://localhost:3000/api/production/check-mo-used?moNumber=PROD/MO/29884&productionType=cartridge"
   ```

2. **Jika `used: true`:**
   - Ini expected behavior
   - MO sudah pernah di-input
   - Jika perlu input lagi, gunakan Solusi B (allow completed MOs)

3. **Jika `used: false`:**
   - Pastikan buka form yang benar (cartridge bukan liquid)
   - Hard refresh browser
   - Check console DevTools untuk error

## 📝 **Summary:**

| Scenario | Solution |
|----------|----------|
| MO sudah di-input, status=active | ✅ Expected - MO sedang dipakai |
| MO sudah di-input, status=completed | Update frontend filter (Solusi B) |
| MO belum di-input | Check type mismatch atau cache issue |
| Type mismatch (cartridge vs liquid) | Buka form yang benar |

## 🔧 **Files:**
- Check endpoint: `GET /api/production/check-mo-used`
- Frontend filter: `client/src/components/ProductionLiquid.js` line 269
