# Production Report Query Documentation

Dokumentasi ini menjelaskan cara mendapatkan data produksi dengan informasi:
- **PIC Input** - Nama PIC yang input data
- **SKU** - Nama produk/SKU
- **MO ID** - Manufacturing Order Number
- **Roll** - Roll Number
- **First Authenticity ID** - ID Authenticity pertama
- **Last Authenticity ID** - ID Authenticity terakhir

## Table of Contents
1. [Node.js Script](#1-nodejs-script)
2. [SQL Query Langsung](#2-sql-query-langsung)
3. [REST API Endpoint](#3-rest-api-endpoint)
4. [Contoh Output](#4-contoh-output)

---

## 1. Node.js Script

### Installation
Pastikan dependencies sudah terinstall:
```bash
npm install sqlite3
```

### Usage

#### Basic Query - Semua data
```bash
node odooAPI/query_production_report.js
```

#### Filter berdasarkan Production Type
```bash
# Liquid saja
node odooAPI/query_production_report.js --type=liquid

# Device saja
node odooAPI/query_production_report.js --type=device

# Cartridge saja
node odooAPI/query_production_report.js --type=cartridge
```

#### Filter berdasarkan MO Number
```bash
node odooAPI/query_production_report.js --mo=MO001
```

#### Filter berdasarkan PIC Name
```bash
node odooAPI/query_production_report.js --pic="Puput Wijanarko"
```

#### Filter berdasarkan Tanggal
```bash
# Dari tanggal tertentu
node odooAPI/query_production_report.js --date-from=2025-01-01

# Sampai tanggal tertentu
node odooAPI/query_production_report.js --date-to=2025-01-31

# Range tanggal
node odooAPI/query_production_report.js --date-from=2025-01-01 --date-to=2025-01-31
```

#### Filter berdasarkan Status
```bash
# Status active
node odooAPI/query_production_report.js --status=active

# Status completed
node odooAPI/query_production_report.js --status=completed
```

#### Output Format

##### Table Format (default)
```bash
node odooAPI/query_production_report.js
```

Output:
```
=== Production Report ===

Filters:
  Production Type: all

Total Records: 10

──────────────────────────────────────────────────────────────────────────────────────────────
PIC Input                  | SKU                  | MO ID           | Roll         | First ID        | Last ID         | Type      
──────────────────────────────────────────────────────────────────────────────────────────────
Puput Wijanarko           | SKU-LIQUID-001       | MO001           | R001         | 001             | 100             | liquid    
Adhari Wijaya             | SKU-DEVICE-002       | MO002           | R002         | 101             | 200             | device    
──────────────────────────────────────────────────────────────────────────────────────────────
```

##### JSON Format
```bash
node odooAPI/query_production_report.js --output=json
```

Output:
```json
[
  {
    "pic_input": "Puput Wijanarko",
    "sku_name": "SKU-LIQUID-001",
    "mo_number": "MO001",
    "roll": "R001",
    "first_authenticity_id": "001",
    "last_authenticity_id": "100",
    "created_at": "2025-01-07 10:30:00",
    "production_type": "liquid"
  }
]
```

##### CSV Format
```bash
node odooAPI/query_production_report.js --output=csv > report.csv
```

Output:
```csv
PIC Input,SKU,MO ID,Roll,First Authenticity ID,Last Authenticity ID,Production Type,Created At
"Puput Wijanarko","SKU-LIQUID-001","MO001","R001","001","100","liquid","2025-01-07 10:30:00"
```

#### Kombinasi Filter
```bash
# Filter berdasarkan type, tanggal, dan export ke CSV
node odooAPI/query_production_report.js --type=liquid --date-from=2025-01-01 --date-to=2025-01-31 --output=csv > liquid_report_january.csv

# Filter berdasarkan MO dan export ke JSON
node odooAPI/query_production_report.js --mo=MO001 --output=json > mo001_report.json

# Filter berdasarkan PIC dan tanggal
node odooAPI/query_production_report.js --pic="Puput" --date-from=2025-01-01 --status=active
```

---

## 2. SQL Query Langsung

Jika Anda ingin menjalankan query langsung di database SQLite, gunakan file `production_report_queries.sql`.

### Menggunakan SQLite CLI

```bash
# Buka database
sqlite3 server/database.sqlite

# Jalankan query
.read odooAPI/production_report_queries.sql

# Atau query specific:
.mode column
.headers on
.width 25 20 15 12 15 15

SELECT 
    pic as 'PIC Input',
    sku_name as 'SKU',
    mo_number as 'MO ID',
    json_extract(authenticity_data, '$[0].rollNumber') as 'Roll',
    json_extract(authenticity_data, '$[0].firstAuthenticity') as 'First Authenticity ID',
    json_extract(authenticity_data, '$[0].lastAuthenticity') as 'Last Authenticity ID'
FROM production_liquid
WHERE status = 'active'
ORDER BY created_at DESC
LIMIT 20;
```

### Query untuk Semua Production Types (UNION)

```sql
SELECT 
    pic as 'PIC Input',
    sku_name as 'SKU',
    mo_number as 'MO ID',
    json_extract(authenticity_data, '$[0].rollNumber') as 'Roll',
    json_extract(authenticity_data, '$[0].firstAuthenticity') as 'First ID',
    json_extract(authenticity_data, '$[0].lastAuthenticity') as 'Last ID',
    'liquid' as 'Type'
FROM production_liquid
WHERE status = 'active'

UNION ALL

SELECT 
    pic, sku_name, mo_number,
    json_extract(authenticity_data, '$[0].rollNumber'),
    json_extract(authenticity_data, '$[0].firstAuthenticity'),
    json_extract(authenticity_data, '$[0].lastAuthenticity'),
    'device'
FROM production_device
WHERE status = 'active'

UNION ALL

SELECT 
    pic, sku_name, mo_number,
    json_extract(authenticity_data, '$[0].rollNumber'),
    json_extract(authenticity_data, '$[0].firstAuthenticity'),
    json_extract(authenticity_data, '$[0].lastAuthenticity'),
    'cartridge'
FROM production_cartridge
WHERE status = 'active'

ORDER BY 'PIC Input';
```

---

## 3. REST API Endpoint

Server menyediakan REST API endpoint untuk mendapatkan production report.

### Endpoint
```
GET /api/production/report
```

### Query Parameters

| Parameter   | Type   | Required | Description                                    | Example                    |
|-------------|--------|----------|------------------------------------------------|----------------------------|
| `type`      | string | No       | Production type: liquid, device, cartridge, all| `liquid`                   |
| `mo_number` | string | No       | Filter by MO Number                            | `MO001`                    |
| `pic`       | string | No       | Filter by PIC name (partial match)             | `Puput`                    |
| `date_from` | string | No       | Start date (YYYY-MM-DD)                        | `2025-01-01`               |
| `date_to`   | string | No       | End date (YYYY-MM-DD)                          | `2025-01-31`               |
| `status`    | string | No       | Filter by status: active, completed, all       | `active`                   |
| `limit`     | number | No       | Limit number of results                        | `50`                       |
| `offset`    | number | No       | Offset for pagination                          | `0`                        |

### Example Requests

#### Menggunakan cURL

```bash
# Basic request - all data
curl http://localhost:1234/api/production/report

# Filter by production type
curl "http://localhost:1234/api/production/report?type=liquid"

# Filter by MO Number
curl "http://localhost:1234/api/production/report?mo_number=MO001"

# Filter by PIC
curl "http://localhost:1234/api/production/report?pic=Puput"

# Filter by date range
curl "http://localhost:1234/api/production/report?date_from=2025-01-01&date_to=2025-01-31"

# Kombinasi filter
curl "http://localhost:1234/api/production/report?type=liquid&status=active&date_from=2025-01-01"

# With pagination
curl "http://localhost:1234/api/production/report?limit=20&offset=0"
```

#### Menggunakan JavaScript (axios)

```javascript
const axios = require('axios');

// Basic request
axios.get('http://localhost:1234/api/production/report')
  .then(response => {
    console.log('Total records:', response.data.total);
    console.log('Data:', response.data.data);
  });

// With filters
axios.get('http://localhost:1234/api/production/report', {
  params: {
    type: 'liquid',
    date_from: '2025-01-01',
    date_to: '2025-01-31',
    status: 'active'
  }
})
  .then(response => {
    console.log(response.data);
  });
```

#### Menggunakan Python (requests)

```python
import requests

# Basic request
response = requests.get('http://localhost:1234/api/production/report')
data = response.json()
print(f"Total records: {data['total']}")

# With filters
params = {
    'type': 'liquid',
    'date_from': '2025-01-01',
    'date_to': '2025-01-31',
    'status': 'active'
}
response = requests.get('http://localhost:1234/api/production/report', params=params)
data = response.json()
print(data)
```

### Response Format

```json
{
  "success": true,
  "total": 150,
  "limit": null,
  "offset": 0,
  "data": [
    {
      "pic_input": "Puput Wijanarko",
      "sku_name": "SKU-LIQUID-001",
      "mo_number": "MO001",
      "roll": "R001",
      "first_authenticity_id": "001",
      "last_authenticity_id": "100",
      "leader_name": "John Doe",
      "shift_number": "1",
      "status": "active",
      "created_at": "2025-01-07 10:30:00",
      "completed_at": null,
      "production_type": "liquid"
    },
    {
      "pic_input": "Adhari Wijaya",
      "sku_name": "SKU-DEVICE-002",
      "mo_number": "MO002",
      "roll": "R002",
      "first_authenticity_id": "101",
      "last_authenticity_id": "200",
      "leader_name": "Jane Smith",
      "shift_number": "2",
      "status": "active",
      "created_at": "2025-01-07 11:00:00",
      "completed_at": null,
      "production_type": "device"
    }
  ]
}
```

---

## 4. Contoh Output

### Contoh 1: Filter by MO Number

**Command:**
```bash
node odooAPI/query_production_report.js --mo=MO001 --output=json
```

**Output:**
```json
[
  {
    "pic_input": "Puput Wijanarko",
    "sku_name": "LIQUID FREEBASE NICOTINE 10ML",
    "mo_number": "MO001",
    "roll": "ROLL-001",
    "first_authenticity_id": "FMX12300001",
    "last_authenticity_id": "FMX12300100",
    "created_at": "2025-01-07 10:30:00",
    "production_type": "liquid"
  },
  {
    "pic_input": "Adhari Wijaya",
    "sku_name": "LIQUID FREEBASE NICOTINE 10ML",
    "mo_number": "MO001",
    "roll": "ROLL-002",
    "first_authenticity_id": "FMX12300101",
    "last_authenticity_id": "FMX12300200",
    "created_at": "2025-01-07 11:00:00",
    "production_type": "liquid"
  }
]
```

### Contoh 2: Filter by PIC and Date Range

**Command:**
```bash
node odooAPI/query_production_report.js --pic="Puput" --date-from=2025-01-01 --date-to=2025-01-07
```

**Output:**
```
=== Production Report ===

Filters:
  Production Type: all
  PIC Name: Puput
  Date From: 2025-01-01
  Date To: 2025-01-07

Total Records: 5

──────────────────────────────────────────────────────────────────────────────────────────────────────────
PIC Input                  | SKU                  | MO ID           | Roll         | First ID        | Last ID         | Type      
──────────────────────────────────────────────────────────────────────────────────────────────────────────
Puput Wijanarko           | LIQUID FREEBASE 10ML | MO001           | ROLL-001     | FMX12300001     | FMX12300100     | liquid    
Puput Wijanarko           | LIQUID FREEBASE 10ML | MO001           | ROLL-002     | FMX12300101     | FMX12300200     | liquid    
Puput Wijanarko           | DEVICE VAPE MOD      | MO002           | ROLL-001     | FMX45600001     | FMX45600050     | device    
Puput Wijanarko           | CARTRIDGE POD 2ML    | MO003           | ROLL-001     | FMX78900001     | FMX78900100     | cartridge 
Puput Wijanarko           | LIQUID SALT NIC 30ML | MO004           | ROLL-001     | FMX12300201     | FMX12300300     | liquid    
──────────────────────────────────────────────────────────────────────────────────────────────────────────
```

### Contoh 3: Export to CSV

**Command:**
```bash
node odooAPI/query_production_report.js --type=liquid --date-from=2025-01-01 --output=csv > liquid_report.csv
```

**File: liquid_report.csv**
```csv
PIC Input,SKU,MO ID,Roll,First Authenticity ID,Last Authenticity ID,Production Type,Created At
"Puput Wijanarko","LIQUID FREEBASE NICOTINE 10ML","MO001","ROLL-001","FMX12300001","FMX12300100","liquid","2025-01-07 10:30:00"
"Adhari Wijaya","LIQUID FREEBASE NICOTINE 10ML","MO001","ROLL-002","FMX12300101","FMX12300200","liquid","2025-01-07 11:00:00"
"Qurotul Aini","LIQUID SALT NICOTINE 30ML","MO004","ROLL-001","FMX12300201","FMX12300300","liquid","2025-01-07 12:00:00"
```

---

## Tips dan Best Practices

### 1. Performance Optimization

Untuk query yang besar, gunakan pagination:
```bash
# First page (0-50)
node odooAPI/query_production_report.js --limit=50 --offset=0

# Second page (51-100)
node odooAPI/query_production_report.js --limit=50 --offset=50
```

### 2. Export Reports

Untuk membuat laporan harian/bulanan:
```bash
# Daily report
node odooAPI/query_production_report.js \
  --date-from=$(date +%Y-%m-%d) \
  --date-to=$(date +%Y-%m-%d) \
  --output=csv > daily_report_$(date +%Y%m%d).csv

# Monthly report
node odooAPI/query_production_report.js \
  --date-from=2025-01-01 \
  --date-to=2025-01-31 \
  --output=csv > monthly_report_202501.csv
```

### 3. Integration dengan Excel

Setelah export ke CSV, Anda bisa membukanya di Excel atau Google Sheets:
```bash
# Export dan buka dengan Excel (Windows)
node odooAPI/query_production_report.js --output=csv > report.csv
start excel report.csv

# Export dan buka dengan Excel (Mac)
node odooAPI/query_production_report.js --output=csv > report.csv
open -a "Microsoft Excel" report.csv
```

### 4. Automation dengan Cron Job

Setup cron job untuk generate report otomatis:
```bash
# Edit crontab
crontab -e

# Add daily report at 23:59
59 23 * * * cd /path/to/project && node odooAPI/query_production_report.js --date-from=$(date +\%Y-\%m-\%d) --output=csv > /path/to/reports/daily_$(date +\%Y\%m\%d).csv
```

---

## Troubleshooting

### Error: Cannot find module 'sqlite3'

**Solution:**
```bash
cd server
npm install sqlite3
```

### Error: Database file not found

**Solution:**
Pastikan path database benar. Script mencari database di `server/database.sqlite`.

### No data returned

**Solusi:**
1. Cek apakah ada data di database:
   ```bash
   sqlite3 server/database.sqlite "SELECT COUNT(*) FROM production_liquid"
   ```
2. Cek filter yang digunakan, mungkin terlalu ketat
3. Coba query tanpa filter dulu

### API Endpoint tidak bisa diakses

**Solusi:**
1. Pastikan server sudah running:
   ```bash
   cd server
   npm start
   ```
2. Cek port yang digunakan (default: 1234)
3. Cek firewall settings

---

## Support

Untuk pertanyaan atau issue, silakan hubungi tim development atau buat issue di repository.

---

## Changelog

### Version 1.0.0 (2025-01-07)
- Initial release
- Node.js script untuk query production report
- SQL queries untuk berbagai use case
- REST API endpoint untuk HTTP access
- Support untuk filter by type, MO, PIC, date, status
- Multiple output formats: table, JSON, CSV


