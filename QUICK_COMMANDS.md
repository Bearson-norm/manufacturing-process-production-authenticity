# Quick Commands - MO Debugging

## 🚀 PowerShell Scripts (Pilih Salah Satu)

### **1. Simplest Script (Recommended)**
```powershell
.\check-mo-simple.ps1 -MoNumber "PROD/MO/29884"
```
Script paling simple, no ampersand issues, no emoji.

### **2. Manual Commands (No Script)**
```powershell
# Check MO in Odoo
Invoke-RestMethod -Uri "http://localhost:3000/api/odoo/debug/query-mo" -Method GET -Body @{moNumber="PROD/MO/29884"}

# Check if used in cartridge
Invoke-RestMethod -Uri "http://localhost:3000/api/production/check-mo-used" -Method GET -Body @{moNumber="PROD/MO/29884"; productionType="cartridge"}

# Check if used in liquid
Invoke-RestMethod -Uri "http://localhost:3000/api/production/check-mo-used" -Method GET -Body @{moNumber="PROD/MO/29884"; productionType="liquid"}

# Check mo-list for cartridge
Invoke-RestMethod -Uri "http://localhost:3000/api/odoo/mo-list" -Method GET -Body @{productionType="cartridge"}
```

## 🌐 Using curl (Alternative)

### **Windows CMD:**
```cmd
curl "http://localhost:3000/api/odoo/debug/query-mo?moNumber=PROD/MO/29884"

curl "http://localhost:3000/api/production/check-mo-used?moNumber=PROD/MO/29884&productionType=cartridge"
```

### **PowerShell with curl:**
```powershell
# Wrap URL in quotes
curl "http://localhost:3000/api/production/check-mo-used?moNumber=PROD/MO/29884&productionType=cartridge"
```

## 📋 Quick Diagnosis

### Step 1: Check if MO exists in Odoo
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/odoo/debug/query-mo" -Method GET -Body @{moNumber="PROD/MO/29884"}
```

**Look for:**
- `found: true` - MO exists ✅
- `would_pass_filter: true` - Will show in API ✅

### Step 2: Check if MO has been used
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/production/check-mo-used" -Method GET -Body @{moNumber="PROD/MO/29884"; productionType="cartridge"}
```

**Look for:**
- `used: false` - Not used yet ✅ (Should appear in dropdown)
- `used: true` - Already used ❌ (Filtered from dropdown)

### Step 3: Check mo-list API
```powershell
$result = Invoke-RestMethod -Uri "http://localhost:3000/api/odoo/mo-list" -Method GET -Body @{productionType="cartridge"}
$result.data | Where-Object { $_.mo_number -eq "PROD/MO/29884" }
```

**Look for:**
- Returns data - MO is in API ✅
- Returns nothing - MO not in API ❌

## 🎯 Common Issues & Quick Fixes

### Issue 1: MO Not in Dropdown
**Cause:** MO already used (filtered by frontend)

**Check:**
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/production/check-mo-used" -Method GET -Body @{moNumber="PROD/MO/29884"; productionType="cartridge"}
```

**If `used: true`:**
- This is **EXPECTED behavior**
- Frontend filters used MOs to prevent duplicates
- See `CHECK_MO_USAGE.md` for solutions

### Issue 2: Wrong Form Type
**Cause:** Opening Liquid form for Cartridge MO

**Check note/SKU:**
```powershell
$mo = Invoke-RestMethod -Uri "http://localhost:3000/api/odoo/debug/query-mo" -Method GET -Body @{moNumber="PROD/MO/29884"}
$mo.note
```

**If contains "CARTRIDGE":**
- Open **Production Cartridge** form, not Liquid!

### Issue 3: MO Not Synced
**Cause:** MO not in cache yet

**Fix:**
```powershell
# Trigger sync
Invoke-RestMethod -Uri "http://localhost:3000/api/admin/sync-mo" -Method POST

# Wait 45 seconds
Start-Sleep -Seconds 45

# Check again
Invoke-RestMethod -Uri "http://localhost:3000/api/odoo/mo-list" -Method GET -Body @{productionType="cartridge"}
```

## 📊 Postman (Alternative)

If PowerShell issues persist, use Postman:

1. Import: `MO_Debug_API.postman_collection.json`
2. Run: "Query MO from Odoo (Direct)"
3. Run: "Check MO in Cache"
4. Run: "Get All Cartridge MOs"

## 🔧 Troubleshooting

### PowerShell Ampersand Error
```
The ampersand (&) character is not allowed.
```

**Fix:** Use `-Body` parameter instead of URL query string
```powershell
# DON'T DO THIS:
Invoke-RestMethod "http://localhost:3000/api?param1=value1&param2=value2"

# DO THIS:
Invoke-RestMethod -Uri "http://localhost:3000/api" -Body @{param1="value1"; param2="value2"}
```

### Server Not Running
```
[ERROR] Unable to connect to the remote server
```

**Fix:**
```powershell
cd server
npm start
```

### CORS Error in Browser
- Not an issue for server-side scripts
- For browser testing, use Postman instead

## 📝 Summary

**Easiest Method:**
```powershell
.\check-mo-simple.ps1 -MoNumber "PROD/MO/29884"
```

**Most Reliable:**
Use Postman with the collection provided.

**Most Detailed:**
Manual commands with `Invoke-RestMethod` (see above).
