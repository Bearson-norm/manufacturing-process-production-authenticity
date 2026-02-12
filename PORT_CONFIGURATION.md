# Konfigurasi Port - Manufacturing Process System

## Port Configuration

Sistem ini menggunakan **2 port berbeda** untuk development:

### 1. Backend Server (API)
- **Port:** `1234` (default)
- **URL:** `http://localhost:1234`
- **Fungsi:** Menyediakan REST API endpoints
- **File:** `server/index.js`, `server/config.js`

### 2. Frontend Client (React)
- **Port:** `3000` (default dari React)
- **URL:** `http://localhost:3000`
- **Fungsi:** User interface (web application)
- **File:** `client/package.json`

## Cara Mengakses

### Development Mode (`npm run dev`)

Saat menjalankan `npm run dev`, kedua server akan berjalan:

1. **Backend API:** `http://localhost:1234`
   - Health check: `http://localhost:1234/health`
   - API endpoints: `http://localhost:1234/api/*`
   - Admin Panel API: `http://localhost:1234/api/admin/*`

2. **Frontend (React):** `http://localhost:3000`
   - **INI YANG HARUS DIBUKA DI BROWSER**
   - Login page: `http://localhost:3000/login`
   - Dashboard: `http://localhost:3000/dashboard`
   - Admin Panel: `http://localhost:3000/admin`

### Proxy Configuration

Frontend (port 3000) sudah dikonfigurasi untuk proxy API requests ke backend (port 1234):

```json
// client/package.json
{
  "proxy": "http://localhost:1234"
}
```

Ini berarti:
- Frontend di `localhost:3000` akan otomatis forward API calls ke `localhost:1234`
- Anda tidak perlu mengetik full URL untuk API calls dari frontend

## Mengubah Port

### Mengubah Backend Port (1234 → 3000)

**Opsi 1: Environment Variable**
```bash
# Windows PowerShell
$env:PORT=3000; npm run dev

# Atau buat file .env di root
PORT=3000
```

**Opsi 2: Edit config.js**
```javascript
// server/config.js
port: parseInt(process.env.PORT || '3000', 10),
```

**Opsi 3: Edit index.js**
```javascript
// server/index.js
const PORT = process.env.PORT || 3000;
```

**PENTING:** Jika mengubah backend ke port 3000, pastikan:
1. Update proxy di `client/package.json` jika perlu
2. Frontend React harus di port lain (misalnya 3001)

### Mengubah Frontend Port (3000 → 3001)

**Opsi 1: Environment Variable**
```bash
# Windows PowerShell
$env:PORT=3001; cd client; npm start
```

**Opsi 2: Edit package.json**
```json
// client/package.json
"scripts": {
  "start": "PORT=3001 react-scripts start"
}
```

## Current Setup (Recommended)

### Development
- **Backend:** `localhost:1234` (API server)
- **Frontend:** `localhost:3000` (React app)
- **Akses Browser:** `http://localhost:3000` ← **INI YANG BENAR**

### Production
- **Backend:** `localhost:1234` (API server)
- **Frontend:** Served dari backend (static files)
- **Akses Browser:** `http://localhost:1234` (semua dari satu port)

## Troubleshooting

### "Tidak menemukan apa-apa di localhost:1234"

**Penyebab:** Anda mengakses backend port, bukan frontend

**Solusi:**
1. Buka `http://localhost:3000` di browser (bukan 1234)
2. Atau jika ingin akses API langsung: `http://localhost:1234/api/admin/config`

### "Cannot GET /" di localhost:1234

**Ini Normal!** Backend port 1234 adalah untuk API, bukan web page.

**Solusi:**
- Akses frontend di `http://localhost:3000`
- Atau akses API endpoint: `http://localhost:1234/health`

### Port Already in Use

**Error:** `Port 1234 is already in use` atau `Port 3000 is already in use`

**Solusi:**
1. Cek process yang menggunakan port:
   ```powershell
   # Windows
   netstat -ano | findstr :1234
   netstat -ano | findstr :3000
   ```

2. Kill process atau ubah port

### Frontend tidak connect ke Backend

**Penyebab:** Proxy tidak bekerja atau backend tidak running

**Solusi:**
1. Pastikan backend running di port 1234
2. Cek `client/package.json` memiliki `"proxy": "http://localhost:1234"`
3. Restart frontend setelah mengubah proxy

## Quick Reference

| Service | Port | URL | Purpose |
|---------|------|-----|---------|
| Backend API | 1234 | http://localhost:1234 | REST API |
| Frontend React | 3000 | http://localhost:3000 | Web UI |
| Health Check | 1234 | http://localhost:1234/health | Status |
| Admin API | 1234 | http://localhost:1234/api/admin/* | Admin endpoints |

## Summary

✅ **Yang Benar:**
- Akses aplikasi web: `http://localhost:3000`
- Akses API langsung: `http://localhost:1234/api/*`

❌ **Yang Salah:**
- Mencoba akses web di `http://localhost:1234` (ini hanya API)
