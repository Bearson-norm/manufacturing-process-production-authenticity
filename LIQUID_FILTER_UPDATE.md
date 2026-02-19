# Update Filter Liquid - Support "TEAM LIQUID"

## 🎯 **Perubahan:**

Filter liquid sekarang akan mencari:
1. ✅ **"TEAM LIQUID"** (prioritas utama)
2. ✅ **"liquid"** (fallback untuk backward compatibility)

## 📝 **Detail Perubahan:**

### **1. Scheduler Filter (Sync dari Odoo)**

**File:** `server/index.js` line ~4529-4531

**Before:**
```javascript
} else if (noteFilter === 'liquid') {
  domainFilter = ['note', 'ilike', 'liquid'];
}
```

**After:**
```javascript
} else if (noteFilter === 'liquid') {
  // Use OR condition to catch "TEAM LIQUID" and "liquid" variations
  domainFilter = ['|', 
    ['note', 'ilike', 'TEAM LIQUID'],  // Primary filter: TEAM LIQUID
    ['note', 'ilike', 'liquid']         // Fallback: any note with "liquid"
  ];
}
```

### **2. Combined Domain Filter (Odoo Query)**

**File:** `server/index.js` line ~4554-4572

**Before:**
```javascript
} else {
  // Simple AND (implicit) for liquid and device
  combinedDomain = [
    domainFilter,
    ["create_date", ">=", startDateStr]
  ];
}
```

**After:**
```javascript
} else if (noteFilter === 'liquid') {
  // Need '&' operator to combine OR condition with date filter
  combinedDomain = [
    '&',  // AND operator
    '|',  // OR for TEAM LIQUID and liquid
    ['note', 'ilike', 'TEAM LIQUID'],
    ['note', 'ilike', 'liquid'],
    ["create_date", ">=", startDateStr]
  ];
} else {
  // Simple AND (implicit) for device
  combinedDomain = [
    domainFilter,
    ["create_date", ">=", startDateStr]
  ];
}
```

### **3. Cache Query (Endpoint mo-list)**

**File:** `server/index.js` line ~3882-3903

**Before:**
```javascript
// Add OR conditions for common typos if filtering for cartridge
if (noteFilter === 'cartridge') {
  query += ` OR LOWER(note) LIKE LOWER($2) OR LOWER(note) LIKE LOWER($3)`;
}

const searchPattern = `%${noteFilter}%`;
let queryParams = [searchPattern];
if (noteFilter === 'cartridge') {
  queryParams.push('%cartirdge%', '%cartrige%');
}
```

**After:**
```javascript
// Add OR conditions for variations
if (noteFilter === 'cartridge') {
  query += ` OR LOWER(note) LIKE LOWER($2) OR LOWER(note) LIKE LOWER($3)`;
} else if (noteFilter === 'liquid') {
  query += ` OR LOWER(note) LIKE LOWER($2)`;
}

const searchPattern = `%${noteFilter}%`;
let queryParams = [searchPattern];
if (noteFilter === 'cartridge') {
  queryParams.push('%cartirdge%', '%cartrige%');
} else if (noteFilter === 'liquid') {
  queryParams.push('%TEAM LIQUID%');
}
```

## ✅ **Hasil:**

Sekarang MO dengan note:
- ✅ `"TEAM LIQUID - SHIFT 1"` → **Akan ter-capture**
- ✅ `"TEAM LIQUID SHIFT 2"` → **Akan ter-capture**
- ✅ `"Production Liquid"` → **Akan ter-capture** (backward compatibility)
- ✅ `"liquid production"` → **Akan ter-capture** (backward compatibility)

## 🚀 **Testing:**

### **1. Restart Server**
```bash
npm run dev
```

### **2. Trigger Sync**
```bash
curl -X POST http://localhost:3000/api/admin/sync-mo
```

### **3. Check Logs**
Look for:
```
🔍 [Scheduler] Querying Odoo for liquid with filter: ['|', ['note', 'ilike', 'TEAM LIQUID'], ['note', 'ilike', 'liquid']]
📊 [Scheduler] Received X MO records from Odoo for liquid
```

### **4. Verify API**
```bash
curl "http://localhost:3000/api/odoo/mo-list?productionType=liquid"
```

Should return MOs with "TEAM LIQUID" in note.

## 📊 **Filter Comparison:**

| Production Type | Filter Pattern |
|----------------|----------------|
| **Cartridge** | `cartridge` OR `cartirdge` OR `cartrige` |
| **Liquid** | `TEAM LIQUID` OR `liquid` |
| **Device** | `device` |

## 🎯 **Summary:**

- ✅ Filter liquid sekarang support "TEAM LIQUID"
- ✅ Tetap backward compatible dengan "liquid"
- ✅ Konsisten dengan filter cartridge (OR condition)
- ✅ Update di 3 tempat: scheduler, Odoo query, cache query

Ready to test! 🚀
