# Production Report Query - Complete Documentation

Sistem lengkap untuk mendapatkan data produksi dengan informasi:
- **PIC Input** - Nama PIC yang input data
- **SKU** - Nama produk
- **MO ID** - Manufacturing Order Number  
- **Roll** - Roll Number
- **First Authenticity ID** - ID Authenticity pertama
- **Last Authenticity ID** - ID Authenticity terakhir

---

## 📚 Documentation Index

| Document | Description | Link |
|----------|-------------|------|
| **Quick Start** | Panduan cepat untuk memulai | [QUICK_START.md](./QUICK_START.md) |
| **Full Documentation** | Dokumentasi lengkap semua fitur | [PRODUCTION_REPORT_README.md](./PRODUCTION_REPORT_README.md) |
| **Postman Guide** | Cara menggunakan Postman Collection | [POSTMAN_GUIDE.md](./POSTMAN_GUIDE.md) |
| **This File** | Overview dan index | README.md |

---

## 🛠️ Available Tools

### 1. Node.js Script
**File:** `query_production_report.js`

Query data production dari command line dengan berbagai filter options.

```bash
node odooAPI/query_production_report.js --type=liquid --output=csv
```

**Features:**
- ✅ Filter by type, MO, PIC, date, status
- ✅ Output: Table, JSON, CSV
- ✅ Fast and efficient

**📖 Docs:** [QUICK_START.md](./QUICK_START.md) | [PRODUCTION_REPORT_README.md](./PRODUCTION_REPORT_README.md)

---

### 2. SQL Queries
**File:** `production_report_queries.sql`

10+ ready-to-use SQL queries untuk berbagai use cases.

```bash
sqlite3 server/database.sqlite < odooAPI/production_report_queries.sql
```

**Features:**
- ✅ Basic queries per production type
- ✅ Queries dengan filter
- ✅ Aggregate queries (GROUP BY)
- ✅ UNION queries untuk semua types

**📖 Docs:** [PRODUCTION_REPORT_README.md](./PRODUCTION_REPORT_README.md#2-sql-query-langsung)

---

### 3. REST API Endpoint
**Endpoint:** `GET /api/production/report`

HTTP API untuk akses data production report.

```bash
curl "http://localhost:1234/api/production/report?type=liquid"
```

**Features:**
- ✅ RESTful API
- ✅ Query parameters untuk filter
- ✅ JSON response
- ✅ Pagination support

**📖 Docs:** [PRODUCTION_REPORT_README.md](./PRODUCTION_REPORT_README.md#3-rest-api-endpoint)

---

### 4. Postman Collection
**File:** `postman-collection.json`

Pre-configured Postman requests untuk testing dan development.

**Features:**
- ✅ 16 pre-configured requests
- ✅ Environment variables
- ✅ Ready to import

**📖 Docs:** [POSTMAN_GUIDE.md](./POSTMAN_GUIDE.md)

---

### 5. Test Script
**File:** `test_production_report.js`

Automated testing untuk API endpoint.

```bash
node odooAPI/test_production_report.js
```

**Features:**
- ✅ 10 automated tests
- ✅ Validates API responses
- ✅ Easy to run

**📖 Docs:** [PRODUCTION_REPORT_README.md](./PRODUCTION_REPORT_README.md)

---

## 🚀 Quick Start

### For Beginners

1. **Start with Quick Start Guide**
   ```bash
   # Read this first
   cat odooAPI/QUICK_START.md
   ```

2. **Try the simplest command**
   ```bash
   node odooAPI/query_production_report.js
   ```

3. **Export to Excel (CSV)**
   ```bash
   node odooAPI/query_production_report.js --output=csv > report.csv
   ```

### For Developers

1. **Test the API endpoint**
   ```bash
   node odooAPI/test_production_report.js
   ```

2. **Import Postman Collection**
   - Open Postman
   - Import `odooAPI/postman-collection.json`
   - Start testing!

3. **Read Full Documentation**
   ```bash
   cat odooAPI/PRODUCTION_REPORT_README.md
   ```

### For Database Admins

1. **Use SQL Queries**
   ```bash
   sqlite3 server/database.sqlite
   .read odooAPI/production_report_queries.sql
   ```

---

## 📋 All Files Overview

| File | Type | Purpose |
|------|------|---------|
| `query_production_report.js` | Script | CLI tool untuk query data |
| `production_report_queries.sql` | SQL | Ready-to-use SQL queries |
| `postman-collection.json` | JSON | Postman collection |
| `test_production_report.js` | Script | Automated testing |
| `PRODUCTION_REPORT_README.md` | Doc | Full documentation |
| `QUICK_START.md` | Doc | Quick start guide |
| `POSTMAN_GUIDE.md` | Doc | Postman usage guide |
| `README.md` | Doc | This file - overview |

---

## 🎯 Common Use Cases

### Use Case 1: Daily Report

**Requirement:** Get today's production report in Excel

**Solution:**
```bash
node odooAPI/query_production_report.js \
  --date-from=$(date +%Y-%m-%d) \
  --date-to=$(date +%Y-%m-%d) \
  --output=csv > daily_report.csv
```

**Alternative (API):**
```bash
curl "http://localhost:1234/api/production/report?date_from=2025-01-07&date_to=2025-01-07"
```

---

### Use Case 2: Monthly Summary

**Requirement:** Get January 2025 production by type

**Solution:**
```bash
# Liquid
node odooAPI/query_production_report.js \
  --type=liquid \
  --date-from=2025-01-01 \
  --date-to=2025-01-31 \
  --output=csv > liquid_jan2025.csv

# Device  
node odooAPI/query_production_report.js \
  --type=device \
  --date-from=2025-01-01 \
  --date-to=2025-01-31 \
  --output=csv > device_jan2025.csv
```

---

### Use Case 3: PIC Performance Report

**Requirement:** Track specific PIC's work for the month

**Solution:**
```bash
node odooAPI/query_production_report.js \
  --pic="Puput Wijanarko" \
  --date-from=2025-01-01 \
  --date-to=2025-01-31
```

---

### Use Case 4: MO Tracking

**Requirement:** Get all data for specific Manufacturing Order

**Solution:**
```bash
# JSON format for system integration
node odooAPI/query_production_report.js \
  --mo=MO001 \
  --output=json > mo001_detail.json

# CSV format for Excel analysis
node odooAPI/query_production_report.js \
  --mo=MO001 \
  --output=csv > mo001_detail.csv
```

---

### Use Case 5: API Integration

**Requirement:** Integrate with external system

**Solution:**

**JavaScript/Node.js:**
```javascript
const axios = require('axios');

const response = await axios.get('http://localhost:1234/api/production/report', {
  params: {
    type: 'liquid',
    status: 'active',
    date_from: '2025-01-01',
    date_to: '2025-01-31'
  }
});

console.log(response.data);
```

**Python:**
```python
import requests

response = requests.get('http://localhost:1234/api/production/report', params={
    'type': 'liquid',
    'status': 'active',
    'date_from': '2025-01-01',
    'date_to': '2025-01-31'
})

data = response.json()
print(data)
```

**cURL:**
```bash
curl "http://localhost:1234/api/production/report?type=liquid&status=active&date_from=2025-01-01&date_to=2025-01-31"
```

---

## 🔍 Query Parameters Reference

| Parameter   | Type   | Values                              | Description                    |
|-------------|--------|-------------------------------------|--------------------------------|
| `type`      | string | liquid, device, cartridge, all      | Production type filter         |
| `mo_number` | string | Any MO number                       | Manufacturing Order Number     |
| `pic`       | string | Any PIC name (partial match)        | PIC name filter                |
| `date_from` | string | YYYY-MM-DD                          | Start date                     |
| `date_to`   | string | YYYY-MM-DD                          | End date                       |
| `status`    | string | active, completed, all              | Status filter                  |
| `limit`     | number | Any positive integer                | Max records to return          |
| `offset`    | number | Any non-negative integer            | Starting position for pagination |

---

## 📊 Response Data Structure

```json
{
  "success": true,
  "total": 100,
  "limit": 20,
  "offset": 0,
  "data": [
    {
      "pic_input": "Puput Wijanarko",
      "sku_name": "LIQUID FREEBASE NICOTINE 10ML",
      "mo_number": "MO001",
      "roll": "ROLL-001",
      "first_authenticity_id": "FMX12300001",
      "last_authenticity_id": "FMX12300100",
      "leader_name": "John Doe",
      "shift_number": "1",
      "status": "active",
      "created_at": "2025-01-07 10:30:00",
      "completed_at": null,
      "production_type": "liquid"
    }
  ]
}
```

---

## 🧪 Testing

### Quick Test

```bash
# Test if everything works
node odooAPI/test_production_report.js
```

### Manual Test

```bash
# 1. Test basic query
node odooAPI/query_production_report.js --limit=5

# 2. Test with filter
node odooAPI/query_production_report.js --type=liquid --limit=5

# 3. Test API endpoint
curl http://localhost:1234/api/production/report?limit=5
```

---

## 🔧 Installation & Setup

### Prerequisites

- Node.js installed
- Server running (`npm start` in server directory)
- Database populated with data

### No Installation Needed!

All tools are ready to use. Just run:

```bash
# Node.js Script
node odooAPI/query_production_report.js

# API Test
node odooAPI/test_production_report.js

# SQL Queries
sqlite3 server/database.sqlite < odooAPI/production_report_queries.sql
```

---

## 🎓 Learning Path

### Beginner → Advanced

1. **Start Here:** [QUICK_START.md](./QUICK_START.md)
   - Learn basic commands
   - Try simple examples

2. **Next:** Try Node.js Script
   ```bash
   node odooAPI/query_production_report.js --help
   node odooAPI/query_production_report.js --type=liquid
   ```

3. **Then:** Import Postman Collection
   - Import `postman-collection.json`
   - Test API endpoints
   - See [POSTMAN_GUIDE.md](./POSTMAN_GUIDE.md)

4. **Advanced:** Read Full Documentation
   - [PRODUCTION_REPORT_README.md](./PRODUCTION_REPORT_README.md)
   - SQL queries
   - API integration
   - Automation

---

## 💡 Tips & Best Practices

### Performance

1. **Use filters** to reduce data size
   ```bash
   # Good - filtered
   node odooAPI/query_production_report.js --date-from=2025-01-01 --date-to=2025-01-31
   
   # Slow - all data
   node odooAPI/query_production_report.js
   ```

2. **Use pagination** for large datasets
   ```bash
   node odooAPI/query_production_report.js --limit=100 --offset=0
   ```

### Data Export

1. **CSV for Excel**
   ```bash
   node odooAPI/query_production_report.js --output=csv > report.csv
   ```

2. **JSON for systems**
   ```bash
   node odooAPI/query_production_report.js --output=json > report.json
   ```

### Automation

Create daily reports automatically:

```bash
# Add to crontab (Linux/Mac)
0 23 * * * cd /path/to/project && node odooAPI/query_production_report.js --date-from=$(date +\%Y-\%m-\%d) --output=csv > /path/to/reports/daily_$(date +\%Y\%m\%d).csv
```

---

## ❓ FAQ

### Q: Bagaimana cara export ke Excel?

A: Gunakan format CSV:
```bash
node odooAPI/query_production_report.js --output=csv > report.csv
```
Kemudian buka file `report.csv` dengan Excel.

### Q: Bagaimana cara filter berdasarkan tanggal hari ini?

A: Gunakan date_from dan date_to dengan tanggal yang sama:
```bash
node odooAPI/query_production_report.js --date-from=2025-01-07 --date-to=2025-01-07
```

### Q: Bagaimana cara mendapatkan data untuk semua type?

A: Jangan gunakan parameter `--type` atau gunakan `--type=all`:
```bash
node odooAPI/query_production_report.js
# atau
node odooAPI/query_production_report.js --type=all
```

### Q: Bagaimana cara mengintegrasikan dengan sistem lain?

A: Gunakan REST API endpoint atau JSON output:
```bash
# Via API
curl http://localhost:1234/api/production/report

# Via script dengan JSON output
node odooAPI/query_production_report.js --output=json
```

---

## 🐛 Troubleshooting

### Error: Cannot find module 'sqlite3'

**Solution:**
```bash
cd server
npm install sqlite3
```

### Error: Database not found

**Solution:**
Check if `server/database.sqlite` exists.

### Empty data response

**Solution:**
1. Check if data exists in database
2. Try query without filters
3. Check date format (YYYY-MM-DD)

### API endpoint not working

**Solution:**
1. Ensure server is running: `npm start`
2. Check port (default: 1234)
3. Verify endpoint: `/api/production/report`

---

## 📞 Support

- **Documentation Issues:** Check [PRODUCTION_REPORT_README.md](./PRODUCTION_REPORT_README.md)
- **Quick Help:** See [QUICK_START.md](./QUICK_START.md)
- **Postman Issues:** See [POSTMAN_GUIDE.md](./POSTMAN_GUIDE.md)
- **Contact:** Development Team

---

## 📝 Version History

### Version 1.0.0 (2025-01-07)

**Initial Release:**
- ✅ Node.js query script
- ✅ SQL queries collection
- ✅ REST API endpoint
- ✅ Postman collection
- ✅ Test script
- ✅ Complete documentation

**Features:**
- Filter by type, MO, PIC, date, status
- Multiple output formats (Table, JSON, CSV)
- Pagination support
- API integration ready

---

## 🎉 Summary

Anda sekarang memiliki **5 cara** untuk query production data:

1. ✅ **Node.js Script** - Fast CLI tool
2. ✅ **SQL Queries** - Direct database access
3. ✅ **REST API** - HTTP/Integration
4. ✅ **Postman** - Testing & Development
5. ✅ **Test Script** - Automated validation

**Pilih yang paling sesuai dengan kebutuhan Anda!**

---

**Happy Querying! 🚀**

