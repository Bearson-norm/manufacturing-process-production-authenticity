# 🌐 Cara Mengakses Server Manufacturing

## ✅ Server SUDAH BERFUNGSI!

Server running di **http://localhost:1234**

---

## 🎯 Cara Akses (3 Metode)

### Method 1: Browser (Paling Mudah)

Buka browser dan akses URL berikut:

1. **Main Application**
   ```
   http://localhost:1234/
   ```
   Halaman utama aplikasi manufacturing

2. **Health Check**
   ```
   http://localhost:1234/health
   ```
   Status server dan database

3. **PIC List**
   ```
   http://localhost:1234/api/pic/list
   ```
   Daftar Person in Charge (JSON)

4. **Production Data**
   ```
   http://localhost:1234/api/production/liquid
   http://localhost:1234/api/production/device  
   http://localhost:1234/api/production/cartridge
   ```

### Method 2: PowerShell (curl)

```powershell
# Health check
Invoke-WebRequest -Uri http://localhost:1234/health | Select-Object -Expand Content

# PIC list
Invoke-WebRequest -Uri http://localhost:1234/api/pic/list | Select-Object -Expand Content

# Production liquid
Invoke-WebRequest -Uri http://localhost:1234/api/production/liquid | Select-Object -Expand Content
```

### Method 3: Postman / Insomnia

1. Open Postman
2. Create new GET request
3. URL: `http://localhost:1234/health`
4. Click "Send"

---

## 📋 Endpoint Yang Tersedia

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/` | Main application page |
| GET | `/health` | Server health check |
| GET | `/api/pic/list` | PIC yang aktif |
| GET | `/api/pic/all` | Semua PIC |
| GET | `/api/production/liquid` | Data production liquid |
| GET | `/api/production/device` | Data production device |
| GET | `/api/production/cartridge` | Data production cartridge |
| GET | `/api/combined-production` | Combined production data |
| GET | `/api/admin/config` | Admin configuration |
| GET | `/api/admin/mo-stats` | MO statistics |

**Full list**: Lihat `SERVER_ENDPOINTS.md`

---

## 🧪 Quick Test

### Test 1: Health Check

**Browser:**
```
http://localhost:1234/health
```

**Expected Result:**
```json
{
  "status": "healthy",
  "database": "connected",
  "uptime": 500.23,
  "timestamp": "2026-01-08T..."
}
```

### Test 2: Main Page

**Browser:**
```
http://localhost:1234/
```

**Expected Result:**
HTML page dengan UI aplikasi manufacturing

### Test 3: PIC Data

**Browser:**
```
http://localhost:1234/api/pic/list
```

**Expected Result:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Puput Wijanarko",
      "is_active": 1,
      ...
    },
    ...
  ]
}
```

---

## ❓ Troubleshooting

### "Cannot access localhost:1234"

1. **Check server running:**
   ```powershell
   netstat -ano | findstr :1234
   ```
   Should show: `LISTENING`

2. **Check server logs:**
   Lihat terminal dimana server running
   Should show: `🚀 Server is running on port 1234`

3. **Try different browser:**
   - Chrome
   - Firefox
   - Edge

4. **Check firewall:**
   Pastikan firewall tidak block port 1234

### "404 Not Found"

Pastikan menggunakan endpoint yang **BENAR**:

❌ **WRONG:**
- `/api/pic` - NOT FOUND

✅ **CORRECT:**
- `/api/pic/list` - Works!
- `/api/pic/all` - Works!

### "White Screen / Blank Page"

Jika frontend putih:

1. Check backend logs untuk error
2. Open browser DevTools (F12)
3. Check Console tab untuk error JavaScript
4. Check Network tab untuk failed requests

---

## 🎯 Akses dari Frontend Client

Jika Anda punya React/Vue/Angular client:

```javascript
// Example fetch
fetch('http://localhost:1234/api/pic/list')
  .then(res => res.json())
  .then(data => {
    console.log('PIC List:', data);
  })
  .catch(err => {
    console.error('Error:', err);
  });
```

**CORS:** Server sudah enable CORS, jadi client bisa akses dari port berbeda.

---

## 📊 Server Info

- **Status**: ✅ RUNNING
- **Port**: 1234
- **Host**: 0.0.0.0 (all interfaces)
- **Database**: PostgreSQL (connected)
- **Environment**: development

---

## 🚀 Next Steps

1. **Test di browser**: http://localhost:1234/
2. **Check health**: http://localhost:1234/health
3. **Test API**: http://localhost:1234/api/pic/list

Jika semua test berhasil, server siap digunakan! ✅

---

## 📞 Still Having Issues?

Jika masih tidak bisa akses:

1. Screenshot error yang muncul
2. Check server logs di terminal
3. Run: `netstat -ano | findstr :1234`
4. Try restart server:
   ```bash
   # Stop: Ctrl+C
   # Start: npm start
   ```

---

**Server is WORKING! Just use the correct endpoints.** 🎉

Main URL: **http://localhost:1234/**

