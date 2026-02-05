# Debug: Localhost vs VPS - MO Filter Tidak Muncul

## 🔍 **Kemungkinan Penyebab:**

### **1. Code Belum Ter-Deploy di VPS**
**Check:**
```bash
# Di VPS
ssh user@vps
cd /home/user/deployments/manufacturing-app
grep -n "TEAM LIQUID" server/index.js

# Harus return line numbers (sekitar 3886, 3904)
# Jika tidak ada, code belum ter-deploy!
```

### **2. Cache Database Berbeda**
**Localhost:** Cache sudah ter-update dengan filter baru  
**VPS:** Cache masih lama (belum sync dengan filter baru)

**Check:**
```bash
# Di VPS - Check last sync time
# Via API
curl "http://localhost:1234/api/odoo/debug/mo-sync"

# Atau langsung query database
psql -h localhost -p 5433 -U admin -d manufacturing_db -c "SELECT MAX(fetched_at) FROM odoo_mo_cache;"
```

### **3. Query Parameter Binding Berbeda**
**Kemungkinan:** PostgreSQL driver atau versi berbeda

**Check:**
```bash
# Di VPS - Check PostgreSQL version
psql -h localhost -p 5433 -U admin -d manufacturing_db -c "SELECT version();"

# Di localhost - Check version
psql -h localhost -p 5432 -U admin -d manufacturing_db -c "SELECT version();"
```

### **4. Data di Cache Berbeda**
**Localhost:** MO sudah ada di cache dengan note "TEAM LIQUID"  
**VPS:** MO belum ada atau note berbeda

**Check:**
```bash
# Di VPS - Check MO specific
psql -h localhost -p 5433 -U admin -d manufacturing_db -c "SELECT mo_number, note FROM odoo_mo_cache WHERE mo_number = 'PROD/MO/29928';"

# Compare dengan localhost
psql -h localhost -p 5432 -U admin -d manufacturing_db -c "SELECT mo_number, note FROM odoo_mo_cache WHERE mo_number = 'PROD/MO/29928';"
```

### **5. Query Execution Berbeda**
**Kemungkinan:** Query di VPS error atau return empty

**Check Logs:**
```bash
# Di VPS
pm2 logs manufacturing-app --lines 200 | grep -i "liquid\|MO List\|error"

# Look for:
# - Query execution errors
# - Parameter binding errors
# - Empty results
```

## 🚀 **Step-by-Step Debugging:**

### **Step 1: Verify Code Ter-Deploy**
```bash
# SSH ke VPS
ssh user@vps
cd /home/user/deployments/manufacturing-app

# Check code
grep -A 5 "noteFilter === 'liquid'" server/index.js

# Should show:
# } else if (noteFilter === 'liquid') {
#   query += ` OR LOWER(note) LIKE LOWER(?)`;
# }

# Check query params
grep -A 3 "queryParams.push.*TEAM LIQUID" server/index.js

# Should show:
# } else if (noteFilter === 'liquid') {
#   queryParams.push('%TEAM LIQUID%');
```

### **Step 2: Check Database Cache**
```bash
# Di VPS - Check if MO exists
psql -h localhost -p 5433 -U admin -d manufacturing_db << EOF
SELECT 
  mo_number, 
  note, 
  create_date,
  fetched_at
FROM odoo_mo_cache 
WHERE mo_number = 'PROD/MO/29928';
EOF

# Check if note contains TEAM LIQUID
psql -h localhost -p 5433 -U admin -d manufacturing_db << EOF
SELECT 
  mo_number, 
  note,
  CASE 
    WHEN LOWER(note) LIKE '%team liquid%' THEN 'MATCH'
    ELSE 'NO MATCH'
  END as match_status
FROM odoo_mo_cache 
WHERE mo_number = 'PROD/MO/29928';
EOF
```

### **Step 3: Test Query Manual**
```bash
# Di VPS - Test query langsung
psql -h localhost -p 5433 -U admin -d manufacturing_db << EOF
SELECT 
  mo_number, 
  sku_name, 
  note
FROM odoo_mo_cache
WHERE (
  LOWER(note) LIKE LOWER('%liquid%')
  OR LOWER(note) LIKE LOWER('%TEAM LIQUID%')
)
AND create_date::TIMESTAMP >= NOW() - INTERVAL '30 days'
ORDER BY create_date DESC
LIMIT 10;
EOF
```

### **Step 4: Check Server Logs**
```bash
# Di VPS - Real-time logs
pm2 logs manufacturing-app --lines 0 | grep -i "liquid\|MO List"

# Trigger API call
curl "http://localhost:1234/api/odoo/mo-list?productionType=liquid" > /dev/null

# Check logs output
# Should see:
# "🔍 [MO List] Querying cache for liquid with patterns: TEAM LIQUID, liquid"
# "📊 [MO List] Found X liquid MOs in cache"
```

### **Step 5: Compare Query Execution**
```bash
# Di VPS - Enable query logging (temporary)
# Edit server/index.js, tambahkan sebelum db.all():
console.log('🔍 [DEBUG] Query:', query);
console.log('🔍 [DEBUG] Params:', queryParams);

# Restart dan test
pm2 restart manufacturing-app
curl "http://localhost:1234/api/odoo/mo-list?productionType=liquid" > /dev/null
pm2 logs manufacturing-app --lines 50 | grep "DEBUG"
```

## 🔧 **Quick Fix Commands:**

### **Fix 1: Re-sync Cache di VPS**
```bash
# Trigger sync dengan filter baru
curl -X POST http://localhost:1234/api/admin/sync-mo

# Wait 60 seconds
sleep 60

# Verify
curl "http://localhost:1234/api/odoo/mo-list?productionType=liquid" | grep "TEAM LIQUID"
```

### **Fix 2: Verify Code Match**
```bash
# Di localhost
cd /path/to/project
grep -n "queryParams.push.*TEAM LIQUID" server/index.js > /tmp/localhost-code.txt

# Di VPS
ssh user@vps
cd /home/user/deployments/manufacturing-app
grep -n "queryParams.push.*TEAM LIQUID" server/index.js > /tmp/vps-code.txt

# Compare
diff /tmp/localhost-code.txt /tmp/vps-code.txt
# Should be identical!
```

### **Fix 3: Direct Database Query Test**
```bash
# Di VPS - Test query dengan parameter binding
psql -h localhost -p 5433 -U admin -d manufacturing_db << 'EOF'
-- Test dengan parameter
PREPARE test_query AS
SELECT mo_number, note
FROM odoo_mo_cache
WHERE (
  LOWER(note) LIKE LOWER($1)
  OR LOWER(note) LIKE LOWER($2)
)
AND create_date::TIMESTAMP >= NOW() - INTERVAL '30 days'
LIMIT 5;

EXECUTE test_query('%liquid%', '%TEAM LIQUID%');
EOF
```

## 📊 **Expected Results:**

### **Jika Code Benar:**
```bash
# Query should return MOs with TEAM LIQUID
# Logs should show:
# "🔍 [MO List] Querying cache for liquid with patterns: TEAM LIQUID, liquid"
# "📊 [MO List] Found X liquid MOs in cache"
# "   MOs with 'TEAM LIQUID': X"
```

### **Jika Code Salah:**
```bash
# Query might error or return empty
# Logs might show:
# "Error fetching MO data from cache: ..."
# Or no logs at all
```

## 🎯 **Most Likely Issues:**

1. **Code belum ter-deploy** (90% kemungkinan)
   - Fix: Verify code di VPS sama dengan localhost

2. **Cache belum ter-update** (80% kemungkinan)
   - Fix: Trigger sync ulang di VPS

3. **Query parameter binding error** (50% kemungkinan)
   - Fix: Check logs untuk error message

4. **Data berbeda** (30% kemungkinan)
   - Fix: Compare data di localhost vs VPS

## 📝 **Action Items:**

1. ✅ Verify code ter-deploy: `grep "TEAM LIQUID" server/index.js`
2. ✅ Check database cache: Query MO langsung
3. ✅ Test query manual: psql dengan parameter
4. ✅ Check server logs: pm2 logs untuk error
5. ✅ Trigger sync ulang: curl POST /api/admin/sync-mo
6. ✅ Compare localhost vs VPS: diff code dan data

Silakan jalankan step-by-step debugging di atas dan share hasilnya! 🔍
