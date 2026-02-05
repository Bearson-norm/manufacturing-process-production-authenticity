# Post-Deploy Checklist - MO Filter Update

## ✅ **Setelah Deploy via GitHub Actions:**

### **1. Verify Server Running**
```bash
# SSH ke VPS
ssh user@vps

# Check PM2 status
pm2 list

# Should see manufacturing-app running (2 instances cluster mode)
```

### **2. Verify Code Ter-Deploy**
```bash
cd /home/user/deployments/manufacturing-app

# Check filter code
grep -n "TEAM LIQUID" server/index.js
# Should return line numbers (4537, 4581, etc)
```

### **3. Trigger MO Sync (PENTING!)**

**Port yang benar: 1234 (bukan 3000!)**

```bash
# Trigger sync
curl -X POST http://localhost:1234/api/admin/sync-mo

# Atau jika pakai domain
curl -X POST http://your-domain/api/admin/sync-mo
```

**Expected Response:**
```json
{
  "success": true,
  "message": "MO sync started. Check server logs for progress.",
  "timestamp": "2026-01-29T..."
}
```

### **4. Wait for Sync (60-90 seconds)**

```bash
# Wait
sleep 60

# Check logs
pm2 logs manufacturing-app --lines 100 | grep -i "liquid\|TEAM LIQUID"
```

**Expected Logs:**
```
🔍 [Scheduler] Querying Odoo for liquid with filter: ['|', ['note', 'ilike', 'TEAM LIQUID'], ['note', 'ilike', 'liquid']]
📊 [Scheduler] Received X MO records from Odoo for liquid
✅ [Scheduler] Successfully updated X MO records for liquid
```

### **5. Verify API**

```bash
# Test API (port 1234!)
curl "http://localhost:1234/api/odoo/mo-list?productionType=liquid" | grep "TEAM LIQUID"

# Atau check full response
curl "http://localhost:1234/api/odoo/mo-list?productionType=liquid" | jq '.data[] | select(.note | contains("TEAM LIQUID"))'
```

## 🔧 **Quick Commands (Copy-Paste):**

```bash
# 1. SSH ke VPS
ssh user@vps

# 2. Verify code
cd /home/user/deployments/manufacturing-app
grep -n "TEAM LIQUID" server/index.js

# 3. Trigger sync (PORT 1234!)
curl -X POST http://localhost:1234/api/admin/sync-mo

# 4. Wait 60 seconds
sleep 60

# 5. Check logs
pm2 logs manufacturing-app --lines 50 | grep -i "liquid"

# 6. Test API
curl "http://localhost:1234/api/odoo/mo-list?productionType=liquid" | grep "TEAM LIQUID"
```

## ⚠️ **Common Mistakes:**

1. ❌ **Port salah**: Menggunakan 3000 padahal 1234
   - ✅ Fix: `curl http://localhost:1234/...`

2. ❌ **Lupa trigger sync**: Code ter-deploy tapi cache belum update
   - ✅ Fix: `curl -X POST http://localhost:1234/api/admin/sync-mo`

3. ❌ **Tidak wait**: Sync butuh 60-90 detik
   - ✅ Fix: Wait setelah trigger sync

## 📊 **Verification:**

### **Check 1: Filter Code Exists**
```bash
grep -n "TEAM LIQUID" server/index.js
# Output: 4537:            ['note', 'ilike', 'TEAM LIQUID'],
#         4581:            ['note', 'ilike', 'TEAM LIQUID'],
```

### **Check 2: Sync Running**
```bash
pm2 logs manufacturing-app | grep -i "liquid\|sync"
# Should see sync logs
```

### **Check 3: MO Appears in API**
```bash
curl "http://localhost:1234/api/odoo/mo-list?productionType=liquid" | jq '.data[] | select(.note | contains("TEAM LIQUID")) | .mo_number'
# Should return MO numbers
```

## 🎯 **Summary:**

**Yang Harus Dilakukan:**
1. ✅ Verify code ter-deploy (grep "TEAM LIQUID")
2. ✅ Trigger sync: `curl -X POST http://localhost:1234/api/admin/sync-mo`
3. ✅ Wait 60-90 seconds
4. ✅ Verify di API: `curl "http://localhost:1234/api/odoo/mo-list?productionType=liquid"`

**Port yang Benar: 1234 (bukan 3000!)**

Silakan coba dengan port 1234! 🚀
