# Troubleshoot: Filter MO Tidak Muncul Setelah Deploy

## 🔍 **Checklist:**

### **1. Verify Code Sudah Ter-Deploy**

**Check di VPS Production:**
```bash
# SSH ke VPS
ssh user@your-vps

# Check apakah code ter-update
cd /path/to/project
git log --oneline -5
# Should see your latest commit

# Check file server/index.js
grep -n "TEAM LIQUID" server/index.js
# Should return line numbers with "TEAM LIQUID"
```

### **2. Restart Server**

**Setelah deploy, server HARUS di-restart:**

```bash
# Jika pakai PM2
pm2 restart server
pm2 logs server --lines 50

# Jika pakai systemd
systemctl restart manufacturing-server
journalctl -u manufacturing-server -n 50 -f

# Jika pakai Docker
docker-compose restart
docker-compose logs -f
```

### **3. Trigger Sync Ulang**

**Database cache perlu di-update dengan filter baru:**

```bash
# Manual trigger sync
curl -X POST http://your-domain/api/admin/sync-mo

# Atau via SSH langsung
# (jika ada script atau bisa akses langsung)
```

**Wait 60-90 seconds untuk sync selesai**

### **4. Verify Filter Bekerja**

**Check logs saat sync:**
```bash
# PM2
pm2 logs server --lines 100 | grep -i "liquid"

# Systemd
journalctl -u manufacturing-server -n 100 | grep -i "liquid"

# Should see:
# "🔍 [Scheduler] Querying Odoo for liquid with filter: ['|', ['note', 'ilike', 'TEAM LIQUID'], ['note', 'ilike', 'liquid']]"
```

**Check API:**
```bash
# Test API
curl "http://your-domain/api/odoo/mo-list?productionType=liquid" | jq '.data[] | select(.note | contains("TEAM LIQUID"))'

# Atau check manual di browser/Postman
```

### **5. Check GitHub Actions**

**Verify GitHub Actions berhasil deploy:**

1. Buka GitHub → Actions tab
2. Check latest workflow run
3. Verify:
   - ✅ Build success
   - ✅ Deploy success
   - ✅ Server restart (jika ada step restart)

**Jika GitHub Actions tidak restart server:**
- Tambahkan step restart di workflow
- Atau restart manual setelah deploy

## 🚀 **Quick Fix Commands:**

```bash
# 1. SSH ke VPS
ssh user@vps

# 2. Pull latest (jika belum auto)
cd /path/to/project
git pull origin main

# 3. Restart server
pm2 restart server
# atau
systemctl restart manufacturing-server

# 4. Wait 5 seconds
sleep 5

# 5. Trigger sync
curl -X POST http://localhost:3000/api/admin/sync-mo

# 6. Wait 60 seconds
sleep 60

# 7. Check logs
pm2 logs server --lines 50 | grep -i "liquid\|TEAM LIQUID"

# 8. Test API
curl "http://localhost:3000/api/odoo/mo-list?productionType=liquid" | grep "TEAM LIQUID"
```

## 🔧 **Update GitHub Actions Workflow (Jika Perlu):**

**File:** `.github/workflows/deploy.yml` (atau nama workflow Anda)

**Pastikan ada step restart:**
```yaml
- name: Restart Server
  run: |
    pm2 restart server
    # atau
    systemctl restart manufacturing-server
```

**Atau trigger sync setelah deploy:**
```yaml
- name: Trigger MO Sync
  run: |
    sleep 10
    curl -X POST http://localhost:3000/api/admin/sync-mo
```

## 📊 **Expected Logs:**

**Setelah restart dan sync, logs harus menunjukkan:**

```
🔍 [Scheduler] Querying Odoo for liquid with filter: ['|', ['note', 'ilike', 'TEAM LIQUID'], ['note', 'ilike', 'liquid']]
📅 [Scheduler] Date range: From 2025-12-30 00:00:00 (30 days ago) to 2026-01-29 23:59:59
📊 [Scheduler] Received X MO records from Odoo for liquid
✅ [Scheduler] Successfully updated X MO records for liquid
```

**Di API mo-list:**
```
🔍 [MO List] Querying cache for liquid with patterns: TEAM LIQUID, liquid
✅ [MO List] Found X MO records for liquid from cache
```

## ❌ **Jika Masih Tidak Muncul:**

### **Check 1: Code Ter-Deploy?**
```bash
grep -n "TEAM LIQUID" server/index.js
# Harus return line numbers
```

### **Check 2: Server Restart?**
```bash
pm2 list
# Check uptime - harus baru restart
```

### **Check 3: Sync Berjalan?**
```bash
# Check last sync time
# Query database atau check logs
```

### **Check 4: MO Ada di Odoo?**
- Login ke Odoo
- Check MO dengan note "TEAM LIQUID - SHIFT 2\nCUKAI 2026"
- Verify create_date < 30 hari

### **Check 5: Filter Syntax Benar?**
```bash
# Check combinedDomain di logs
# Harus ada: ['&', '|', ['note', 'ilike', 'TEAM LIQUID'], ...]
```

## 🎯 **Summary:**

**Yang Harus Dilakukan:**
1. ✅ Verify code ter-deploy (git log, grep)
2. ✅ **Restart server** (penting!)
3. ✅ **Trigger sync ulang** (update cache dengan filter baru)
4. ✅ Check logs untuk verify filter bekerja
5. ✅ Test API untuk verify MO muncul

**Most Common Issue:**
- Server tidak restart setelah deploy
- Cache database masih lama (belum sync dengan filter baru)

Silakan coba langkah-langkah di atas dan beritahu hasilnya! 🚀
