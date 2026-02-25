# ⚡ Quick Fix - 3 Commands

Error yang Anda alami sudah diperbaiki. Jalankan 3 command ini:

## Fix

```bash
cd server

# 1. Fix database schema (tambah kolom yang hilang)
npm run fix:schema

# 2. Test database
npm run test:db

# 3. Restart aplikasi
npm start
```

## Verify

```bash
# Test API
curl http://localhost:1234/health

# Buka frontend
# Browser: http://localhost:3000 (atau port client Anda)
```

## Jika Masih Error

Lihat file **FIX_ERRORS.md** untuk troubleshooting lengkap.

---

**Yang Sudah Diperbaiki:**
- ✅ Column `sku_name` missing - FIXED
- ✅ SQL syntax `INSERT OR REPLACE` - FIXED to PostgreSQL syntax
- ✅ Date functions `datetime()` - FIXED to PostgreSQL `NOW()`
- ✅ Placeholders `?` - FIXED to `$1, $2, ...`

**Status:** Ready to run! 🚀


