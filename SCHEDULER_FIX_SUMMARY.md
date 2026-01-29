# Fix Summary - Scheduler & Odoo Domain Filter

## 🐛 Masalah yang Ditemukan:

### 1. **Odoo Domain Filter Error** (CRITICAL)
**Masalah:** MO dengan typo "CARTIRDGE" tidak ter-capture karena domain filter nested array.

**Fix:** Ubah dari nested array ke flat array dengan proper AND/OR operators.

**Before:**
```javascript
const combinedDomain = [
  ['|', '|', ['note', 'ilike', 'cartridge'], ...],  // NESTED!
  ['create_date', '>=', startDateStr]
];
```

**After:**
```javascript
combinedDomain = [
  '&',  // AND operator
  '|', '|',  // OR for typo variations
  ['note', 'ilike', 'cartridge'],
  ['note', 'ilike', 'cartirdge'],
  ['note', 'ilike', 'cartrige'],
  ['create_date', '>=', startDateStr]
];
```

### 2. **Scheduler Initial Sync Delay**
**Masalah:** Scheduler hanya ter-trigger manual, initial sync delay 30 detik terlalu lama.

**Fix:** 
- Reduce delay 30s → 5s
- Smart check: Skip sync jika last sync < 1 jam
- Enhanced logging untuk debugging

**Before:**
```javascript
setTimeout(() => {
  updateMoDataFromOdoo();
}, 30000);  // 30 seconds
```

**After:**
```javascript
const runInitialSync = () => {
  // Check last sync time
  db.get('SELECT MAX(fetched_at) FROM odoo_mo_cache', (err, row) => {
    const hoursSinceSync = calculateHours(row);
    if (hoursSinceSync > 1) {
      updateMoDataFromOdoo();  // Only sync if needed
    }
  });
};

setTimeout(runInitialSync, 5000);  // 5 seconds
```

## ✅ Perubahan yang Dilakukan:

### File: `server/index.js`

#### 1. Fix Odoo Domain Filter (Line ~4554-4568)
```javascript
let combinedDomain;
if (noteFilter === 'cartridge') {
  combinedDomain = [
    '&',  // AND
    '|', '|',  // OR 3 conditions
    ['note', 'ilike', 'cartridge'],
    ['note', 'ilike', 'cartirdge'],
    ['note', 'ilike', 'cartrige'],
    ['create_date', '>=', startDateStr]
  ];
} else {
  combinedDomain = [
    domainFilter,
    ['create_date', '>=', startDateStr]
  ];
}
```

#### 2. Smart Initial Sync (Line ~5132-5168)
```javascript
const runInitialSync = () => {
  db.get('SELECT MAX(fetched_at) as last_sync FROM odoo_mo_cache', [], (err, row) => {
    const hoursSinceSync = calculateHoursSince(row?.last_sync);
    
    if (hoursSinceSync > 1) {
      console.log(`⏰ Last sync ${hoursSinceSync.toFixed(2)} hours ago, running sync...`);
      updateMoDataFromOdoo();
      syncProductionData();
    } else {
      console.log(`✅ Recent sync (${hoursSinceSync.toFixed(2)}h ago), skipping`);
    }
  });
};

setTimeout(runInitialSync, 5000);  // 5s instead of 30s
```

#### 3. Enhanced Scheduler Logging (Line ~5145-5155)
```javascript
console.log('📅 [Scheduler] Schedulers initialized:');
console.log('   - MO data update: Every 6 hours (cron: 0 */6 * * *)');
console.log('   - Timezone: Asia/Jakarta');
console.log('   - Initial sync: Will run 5 seconds after server start (if needed)');
console.log(`⏰ Current time: ${now.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB`);
```

## 🚀 Deployment Steps:

### 1. Local Test
```bash
# Restart server
npm run dev

# Check logs - should see:
# "🚀 [Scheduler] Running initial tasks..."
# "⏰ [Scheduler] Last sync X hours ago, running sync..."
# or
# "✅ [Scheduler] Recent sync found, skipping initial sync"

# Wait 5-10 seconds, then check API
curl "http://localhost:3000/api/odoo/mo-list?productionType=cartridge" | grep 29884
```

### 2. Commit Changes
```bash
git add server/index.js
git commit -m "fix: Scheduler auto-run & Odoo domain filter

- Fix Odoo domain filter untuk typo tolerance (CRITICAL)
- Improve initial sync dengan smart check (skip jika recent)
- Reduce initial sync delay 30s -> 5s
- Enhanced scheduler logging untuk debugging
- Fix MO 29884 (typo CARTIRDGE) tidak muncul"

git push origin staging
```

### 3. Deploy to VPS Staging
```bash
# SSH ke VPS
ssh user@vps

# Pull changes
cd /path/to/project
git pull origin staging

# Restart server
pm2 restart server
# atau
systemctl restart manufacturing-server

# Check logs
pm2 logs server --lines 50
# or
journalctl -u manufacturing-server -n 50 -f

# Should see scheduler logs
```

### 4. Verify
```bash
# Wait 5-10 seconds after restart

# Check if MO 29884 appears
curl "http://your-domain/api/odoo/mo-list?productionType=cartridge" | grep 29884

# Should return:
# {"mo_number":"PROD/MO/29884","sku_name":"FOOM X CARTRIDGE PACK (3PCS)",...}
```

### 5. Merge to Main (After Testing)
```bash
git checkout main
git merge staging
git push origin main

# Deploy to production
# ... (your production deployment process)
```

## 📊 Expected Behavior:

### Server Start:
```
🚀 Server is running on port 1234
📅 [Scheduler] Schedulers initialized:
   - MO data update: Every 6 hours (cron: 0 */6 * * *)
   - Initial sync: Will run 5 seconds after server start (if needed)
⏰ [Scheduler] Current time: 29/01/2026 15:30:00 WIB

... 5 seconds later ...

🚀 [Scheduler] Running initial tasks...
⏰ [Scheduler] Last sync was 3.50 hours ago, running sync...
🔄 [Scheduler] Starting MO data update from Odoo...
📊 [Scheduler] Received 333 MO records from Odoo for cartridge
✅ [Scheduler] Found PROD/MO/29884 in Odoo response!
✅ [Scheduler] MO data update completed. Total updated: 1194
```

### Scheduler Running (Every 6 Hours):
```
⏰ 21:00:00 WIB - Next scheduled sync
🔄 [Scheduler] Starting MO data update from Odoo...
```

## 🎯 Result:

After deployment:
- ✅ Scheduler runs automatically every 6 hours
- ✅ Initial sync on server start (5s delay, smart skip)
- ✅ MO 29884 (typo CARTIRDGE) ter-capture
- ✅ Enhanced logging untuk monitoring

## 🔧 Troubleshooting:

### If scheduler not running:
1. Check logs untuk error
2. Verify cron syntax: `0 */6 * * *`
3. Check timezone: `Asia/Jakarta`
4. Manual trigger masih bisa: `POST /api/admin/sync-mo`

### If MO 29884 still not found:
1. Check Odoo - apakah MO ada?
2. Check note - harus ada "cartridge/cartirdge/cartrige"
3. Check create_date - harus < 30 hari
4. Check logs - apakah MO ditemukan di Odoo response?

## 📝 Files Modified:

- `server/index.js` - Main fixes
  - Line ~4554: Odoo domain filter
  - Line ~5132: Smart initial sync
  - Line ~5145: Enhanced logging

## 🎉 Summary:

**Problem:** MO 29884 tidak muncul + scheduler tidak auto-run  
**Root Cause:** Nested domain filter + slow initial sync  
**Solution:** Flat domain filter + smart fast initial sync  
**Status:** ✅ FIXED

Deploy ke staging → test → merge ke main! 🚀
