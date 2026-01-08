# Production Report - Quick Start Guide

Panduan cepat untuk mendapatkan data produksi dengan informasi PIC Input, SKU, MO ID, Roll, First Authenticity ID, dan Last Authenticity ID.

---

## 📋 3 Cara Akses Data

### 1️⃣ Via Node.js Script (Recommended)

```bash
# All data
node odooAPI/query_production_report.js

# Specific type
node odooAPI/query_production_report.js --type=liquid

# Filter by MO
node odooAPI/query_production_report.js --mo=MO001

# Export to CSV
node odooAPI/query_production_report.js --output=csv > report.csv

# Export to JSON
node odooAPI/query_production_report.js --output=json > report.json
```

### 2️⃣ Via REST API

```bash
# All data
curl http://localhost:1234/api/production/report

# Filter by type
curl http://localhost:1234/api/production/report?type=liquid

# Filter by MO
curl "http://localhost:1234/api/production/report?mo_number=MO001"

# Filter by date range
curl "http://localhost:1234/api/production/report?date_from=2025-01-01&date_to=2025-01-31"
```

### 3️⃣ Via SQL Direct

```bash
sqlite3 server/database.sqlite
```

```sql
SELECT 
    pic as 'PIC Input',
    sku_name as 'SKU',
    mo_number as 'MO ID',
    json_extract(authenticity_data, '$[0].rollNumber') as 'Roll',
    json_extract(authenticity_data, '$[0].firstAuthenticity') as 'First ID',
    json_extract(authenticity_data, '$[0].lastAuthenticity') as 'Last ID'
FROM production_liquid
ORDER BY created_at DESC;
```

---

## 🚀 Common Use Cases

### Laporan Harian

```bash
# Today's report
node odooAPI/query_production_report.js \
  --date-from=$(date +%Y-%m-%d) \
  --date-to=$(date +%Y-%m-%d) \
  --output=csv > daily_report.csv
```

### Laporan per PIC

```bash
# Report untuk specific PIC
node odooAPI/query_production_report.js \
  --pic="Puput Wijanarko" \
  --date-from=2025-01-01 \
  --date-to=2025-01-31
```

### Laporan per MO

```bash
# Detail untuk specific MO
node odooAPI/query_production_report.js \
  --mo=MO001 \
  --output=json
```

### Laporan Bulanan

```bash
# January 2025
node odooAPI/query_production_report.js \
  --date-from=2025-01-01 \
  --date-to=2025-01-31 \
  --output=csv > report_jan2025.csv
```

### Filter Multiple

```bash
# Liquid + Active + Date Range
node odooAPI/query_production_report.js \
  --type=liquid \
  --status=active \
  --date-from=2025-01-01 \
  --date-to=2025-01-31
```

---

## 📊 Output Formats

### Table (Console)

```bash
node odooAPI/query_production_report.js
```

Output:
```
=== Production Report ===
Total Records: 10

──────────────────────────────────────────────────────────────────
PIC Input          | SKU            | MO ID   | Roll    | First ID
──────────────────────────────────────────────────────────────────
Puput Wijanarko   | SKU-001        | MO001   | R001    | FMX001
──────────────────────────────────────────────────────────────────
```

### JSON

```bash
node odooAPI/query_production_report.js --output=json
```

### CSV (Excel-ready)

```bash
node odooAPI/query_production_report.js --output=csv > report.csv
```

---

## 🔧 API Endpoints

### GET /api/production/report

**Parameters:**
- `type` - liquid, device, cartridge, all
- `mo_number` - Filter by MO Number
- `pic` - Filter by PIC name
- `date_from` - Start date (YYYY-MM-DD)
- `date_to` - End date (YYYY-MM-DD)
- `status` - active, completed, all
- `limit` - Pagination limit
- `offset` - Pagination offset

**Response:**
```json
{
  "success": true,
  "total": 100,
  "data": [
    {
      "pic_input": "Puput Wijanarko",
      "sku_name": "LIQUID FREEBASE 10ML",
      "mo_number": "MO001",
      "roll": "R001",
      "first_authenticity_id": "FMX001",
      "last_authenticity_id": "FMX100",
      "production_type": "liquid",
      "created_at": "2025-01-07 10:30:00"
    }
  ]
}
```

---

## 🧪 Testing

```bash
# Test API endpoint
node odooAPI/test_production_report.js
```

---

## 📚 Full Documentation

Lihat dokumentasi lengkap di: `odooAPI/PRODUCTION_REPORT_README.md`

---

## ❓ Help

```bash
# Node.js script help
node odooAPI/query_production_report.js --help
```

---

## 📝 File Locations

- **Node.js Script**: `odooAPI/query_production_report.js`
- **SQL Queries**: `odooAPI/production_report_queries.sql`
- **API Endpoint**: `server/index.js` (line ~821)
- **Full Documentation**: `odooAPI/PRODUCTION_REPORT_README.md`
- **Test Script**: `odooAPI/test_production_report.js`
- **This Guide**: `odooAPI/QUICK_START.md`

---

## ⚡ Quick Examples

```bash
# 1. All liquid production
node odooAPI/query_production_report.js --type=liquid

# 2. Specific MO as JSON
node odooAPI/query_production_report.js --mo=MO001 --output=json

# 3. Date range as CSV
node odooAPI/query_production_report.js --date-from=2025-01-01 --date-to=2025-01-31 --output=csv > jan2025.csv

# 4. Via API
curl "http://localhost:1234/api/production/report?type=liquid&limit=10"

# 5. Via SQL
sqlite3 server/database.sqlite < odooAPI/production_report_queries.sql
```

---

## 💡 Tips

1. **Export to Excel**: Use `--output=csv` and open in Excel
2. **Large datasets**: Use pagination with `--limit` and `--offset`
3. **Automation**: Add to cron for daily reports
4. **Filtering**: Combine multiple filters for precise results
5. **Performance**: Filter by date range for faster queries

---

**Need help?** Contact development team or open an issue.


