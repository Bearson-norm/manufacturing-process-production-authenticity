# 🌐 Server Endpoints - Manufacturing Process API

## ✅ Server Status: RUNNING

Server berjalan di **http://localhost:1234**

---

## 🏥 Health Check

### GET /health
Check kesehatan server dan database connection

**Request:**
```bash
curl http://localhost:1234/health
```

**Response:**
```json
{
  "status": "healthy",
  "database": "connected",
  "uptime": 241.76,
  "timestamp": "2026-01-08T14:48:58.345Z"
}
```

---

## 👥 PIC (Person in Charge) Endpoints

### GET /api/pic/list
Get semua PIC yang aktif

**Request:**
```bash
curl http://localhost:1234/api/pic/list
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Puput Wijanarko",
      "is_active": 1,
      "created_at": "2026-01-08T...",
      "updated_at": "2026-01-08T..."
    },
    ...
  ]
}
```

### GET /api/pic/all
Get semua PIC (termasuk yang tidak aktif)

**Request:**
```bash
curl http://localhost:1234/api/pic/all
```

### POST /api/pic/add
Tambah PIC baru

**Request:**
```bash
curl -X POST http://localhost:1234/api/pic/add \
  -H "Content-Type: application/json" \
  -d '{"name": "John Doe"}'
```

### PUT /api/pic/update/:id
Update PIC

**Request:**
```bash
curl -X PUT http://localhost:1234/api/pic/update/1 \
  -H "Content-Type: application/json" \
  -d '{"name": "John Doe Updated", "is_active": 1}'
```

### DELETE /api/pic/delete/:id
Soft delete PIC (set is_active = 0)

**Request:**
```bash
curl -X DELETE http://localhost:1234/api/pic/delete/1
```

---

## 📦 Production Endpoints

### GET /api/production/liquid
Get production liquid records

**Request:**
```bash
curl http://localhost:1234/api/production/liquid
```

### GET /api/production/device
Get production device records

**Request:**
```bash
curl http://localhost:1234/api/production/device
```

### GET /api/production/cartridge
Get production cartridge records

**Request:**
```bash
curl http://localhost:1234/api/production/cartridge
```

### POST /api/production/liquid
Create production liquid record

**Request:**
```bash
curl -X POST http://localhost:1234/api/production/liquid \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "SESSION-001",
    "leader_name": "John Doe",
    "shift_number": "1",
    "pic": "Jane Doe",
    "mo_number": "MO-001",
    "sku_name": "Product A",
    "authenticity_data": "{\"codes\": [\"123\", \"456\"]}"
  }'
```

### GET /api/combined-production
Get combined production data (liquid + device + cartridge)

**Request:**
```bash
curl http://localhost:1234/api/combined-production
```

**Query Parameters:**
- `mo_number` - Filter by MO number
- `production_type` - Filter by type (liquid/device/cartridge)
- `start_date` - Filter from date (YYYY-MM-DD)
- `end_date` - Filter to date (YYYY-MM-DD)

**Example:**
```bash
curl "http://localhost:1234/api/combined-production?mo_number=MO-001"
```

---

## 🔍 Search & Query

### GET /api/search/mo
Search MO dari cache

**Query Parameters:**
- `q` - Search term

**Request:**
```bash
curl "http://localhost:1234/api/search/mo?q=MO-001"
```

### GET /api/production/by-mo/:moNumber
Get production data by MO number

**Request:**
```bash
curl http://localhost:1234/api/production/by-mo/MO-001
```

---

## 📊 Statistics & Reports

### GET /api/production/stats
Get production statistics

**Request:**
```bash
curl http://localhost:1234/api/production/stats
```

### GET /api/admin/mo-stats
Get MO cache statistics

**Request:**
```bash
curl http://localhost:1234/api/admin/mo-stats
```

---

## ⚙️ Admin Configuration

### GET /api/admin/config
Get admin configuration

**Request:**
```bash
curl http://localhost:1234/api/admin/config
```

**Response:**
```json
{
  "success": true,
  "config": {
    "odoo_session_id": "...",
    "odoo_base_url": "https://foomx.odoo.com",
    "external_api_url": "...",
    "api_key": "..."
  }
}
```

### POST /api/admin/config
Update admin configuration

**Request:**
```bash
curl -X POST http://localhost:1234/api/admin/config \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "new_session_id",
    "odooBaseUrl": "https://foomx.odoo.com"
  }'
```

### POST /api/admin/generate-api-key
Generate new API key

**Request:**
```bash
curl -X POST http://localhost:1234/api/admin/generate-api-key
```

---

## 🔄 Sync & Scheduler

### POST /api/admin/sync-production
Manually trigger production data sync

**Request:**
```bash
curl -X POST http://localhost:1234/api/admin/sync-production
```

### POST /api/admin/update-mo-cache
Manually trigger MO cache update from Odoo

**Request:**
```bash
curl -X POST http://localhost:1234/api/admin/update-mo-cache
```

### POST /api/admin/cleanup-old-mo
Manually trigger cleanup old MO data (>7 days)

**Request:**
```bash
curl -X POST http://localhost:1234/api/admin/cleanup-old-mo
```

---

## 🗑️ Buffer & Reject

### GET /api/buffer/liquid/:moNumber
Get buffer liquid data

**Request:**
```bash
curl http://localhost:1234/api/buffer/liquid/MO-001
```

### GET /api/reject/liquid/:moNumber
Get reject liquid data

**Request:**
```bash
curl http://localhost:1234/api/reject/liquid/MO-001
```

### POST /api/buffer/liquid
Create buffer liquid record

### POST /api/reject/liquid
Create reject liquid record

---

## 🌐 Frontend

### GET /
Main application (HTML page)

**Request:**
```
http://localhost:1234/
```

Serves the main web application interface.

---

## 📝 Testing Commands

### Test Semua Endpoint Utama

```bash
# Health check
curl http://localhost:1234/health

# PIC list
curl http://localhost:1234/api/pic/list

# Production liquid
curl http://localhost:1234/api/production/liquid

# Combined production
curl http://localhost:1234/api/combined-production

# Admin config
curl http://localhost:1234/api/admin/config

# MO stats
curl http://localhost:1234/api/admin/mo-stats
```

### Test di Browser

Buka browser dan akses:
- http://localhost:1234/ - Main app
- http://localhost:1234/health - Health check
- http://localhost:1234/api/pic/list - PIC data

---

## 🔧 Troubleshooting

### "Cannot connect to server"

1. Check server running:
   ```bash
   netstat -ano | findstr :1234
   ```

2. Test with curl/test script:
   ```bash
   node server/test-server.js
   ```

3. Check logs for errors

### "404 Not Found"

Pastikan menggunakan endpoint yang benar. Lihat daftar di atas.

**Contoh:**
- ❌ `/api/pic` - NOT FOUND
- ✅ `/api/pic/list` - CORRECT

### "500 Internal Server Error"

Check database connection:
```bash
curl http://localhost:1234/health
```

If database disconnected, restart server.

---

## 📊 Server Info

- **Port**: 1234
- **Host**: 0.0.0.0 (accessible from all interfaces)
- **Database**: PostgreSQL
- **Environment**: development
- **Status**: ✅ RUNNING

---

## 🎯 Quick Access URLs

Open in browser:
- http://localhost:1234/ - Main Application
- http://localhost:1234/health - Health Status

---

**Last Updated**: 2026-01-08  
**Server Version**: 1.0.1 (PostgreSQL)

