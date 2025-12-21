# API Documentation - Production Combined

## Tabel Database: `production_combined`

Tabel ini menggabungkan data dari `production_liquid`, `production_device`, dan `production_cartridge`.

### Struktur Tabel:
- `id` - INTEGER PRIMARY KEY AUTOINCREMENT
- `production_type` - TEXT NOT NULL (liquid/device/cartridge)
- `session_id` - TEXT NOT NULL
- `leader_name` - TEXT NOT NULL
- `shift_number` - TEXT NOT NULL
- `pic` - TEXT NOT NULL
- `mo_number` - TEXT NOT NULL
- `sku_name` - TEXT NOT NULL
- `authenticity_data` - TEXT NOT NULL (JSON string)
- `status` - TEXT DEFAULT 'active'
- `created_at` - DATETIME DEFAULT CURRENT_TIMESTAMP

---

## Endpoints

### 1. GET `/api/production/combined`

Query data berdasarkan MO Number dan Created_at.

#### Query Parameters:
- `moNumber` (optional) - Filter berdasarkan MO Number
- `created_at` (optional) - Filter berdasarkan tanggal exact (format: YYYY-MM-DD)
- `startDate` (optional) - Filter mulai dari tanggal (format: YYYY-MM-DD)
- `endDate` (optional) - Filter sampai tanggal (format: YYYY-MM-DD)
- `production_type` (optional) - Filter berdasarkan tipe production (liquid/device/cartridge)

#### Contoh Request:

```bash
# Get semua data
GET http://localhost:5000/api/production/combined

# Get berdasarkan MO Number
GET http://localhost:5000/api/production/combined?moNumber=MO001

# Get berdasarkan tanggal
GET http://localhost:5000/api/production/combined?created_at=2024-01-15

# Get berdasarkan range tanggal
GET http://localhost:5000/api/production/combined?startDate=2024-01-01&endDate=2024-01-31

# Get berdasarkan MO Number dan tanggal
GET http://localhost:5000/api/production/combined?moNumber=MO001&created_at=2024-01-15

# Get berdasarkan production type
GET http://localhost:5000/api/production/combined?production_type=liquid

# Kombinasi filter
GET http://localhost:5000/api/production/combined?moNumber=MO001&startDate=2024-01-01&endDate=2024-01-31&production_type=liquid
```

#### Response:
```json
{
  "count": 2,
  "data": [
    {
      "id": 1,
      "production_type": "liquid",
      "session_id": "Bagas Prasetya_1_1234567890",
      "leader_name": "Bagas Prasetya",
      "shift_number": "1",
      "pic": "John Doe",
      "mo_number": "MO001",
      "sku_name": "SKU001",
      "authenticity_data": [
        {
          "firstAuthenticity": "A001",
          "lastAuthenticity": "A010",
          "rollNumber": "R001"
        }
      ],
      "status": "active",
      "created_at": "2024-01-15 10:30:00"
    }
  ]
}
```

---

### 2. POST `/api/production/combined`

Insert data dummy atau data baru ke tabel combined.

#### Request Body:
```json
{
  "production_type": "liquid",
  "session_id": "Bagas Prasetya_1_1234567890",
  "leader_name": "Bagas Prasetya",
  "shift_number": "1",
  "pic": "John Doe",
  "mo_number": "MO001",
  "sku_name": "SKU001",
  "authenticity_data": [
    {
      "firstAuthenticity": "A001",
      "lastAuthenticity": "A010",
      "rollNumber": "R001"
    },
    {
      "firstAuthenticity": "B001",
      "lastAuthenticity": "B010",
      "rollNumber": "R002"
    }
  ],
  "status": "active"
}
```

#### Contoh dengan cURL:
```bash
curl -X POST http://localhost:5000/api/production/combined \
  -H "Content-Type: application/json" \
  -d '{
    "production_type": "liquid",
    "session_id": "Bagas Prasetya_1_1234567890",
    "leader_name": "Bagas Prasetya",
    "shift_number": "1",
    "pic": "John Doe",
    "mo_number": "MO001",
    "sku_name": "SKU001",
    "authenticity_data": [
      {
        "firstAuthenticity": "A001",
        "lastAuthenticity": "A010",
        "rollNumber": "R001"
      }
    ]
  }'
```

#### Response:
```json
{
  "message": "Data saved successfully",
  "saved_count": 2,
  "data": [
    {
      "id": 1,
      "production_type": "liquid",
      "session_id": "Bagas Prasetya_1_1234567890",
      "leader_name": "Bagas Prasetya",
      "shift_number": "1",
      "pic": "John Doe",
      "mo_number": "MO001",
      "sku_name": "SKU001",
      "authenticity_data": [
        {
          "firstAuthenticity": "A001",
          "lastAuthenticity": "A010",
          "rollNumber": "R001"
        }
      ],
      "status": "active"
    },
    {
      "id": 2,
      "production_type": "liquid",
      "session_id": "Bagas Prasetya_1_1234567890",
      "leader_name": "Bagas Prasetya",
      "shift_number": "1",
      "pic": "John Doe",
      "mo_number": "MO001",
      "sku_name": "SKU001",
      "authenticity_data": [
        {
          "firstAuthenticity": "B001",
          "lastAuthenticity": "B010",
          "rollNumber": "R002"
        }
      ],
      "status": "active"
    }
  ]
}
```

---

### 3. POST `/api/production/combined/sync`

Sync data dari tabel existing (production_liquid, production_device, production_cartridge) ke production_combined.

#### Request Body:
```json
{
  "production_type": "liquid"
}
```

#### Contoh dengan cURL:
```bash
# Sync data dari production_liquid
curl -X POST http://localhost:5000/api/production/combined/sync \
  -H "Content-Type: application/json" \
  -d '{"production_type": "liquid"}'

# Sync data dari production_device
curl -X POST http://localhost:5000/api/production/combined/sync \
  -H "Content-Type: application/json" \
  -d '{"production_type": "device"}'

# Sync data dari production_cartridge
curl -X POST http://localhost:5000/api/production/combined/sync \
  -H "Content-Type: application/json" \
  -d '{"production_type": "cartridge"}'
```

#### Response:
```json
{
  "message": "Data synced successfully",
  "synced_count": 10,
  "total_in_source": 10
}
```

---

## Contoh Data Dummy

### Production Liquid:
```json
{
  "production_type": "liquid",
  "session_id": "Bagas Prasetya_1_1705123456789",
  "leader_name": "Bagas Prasetya",
  "shift_number": "1",
  "pic": "Operator A",
  "mo_number": "MO-LIQUID-001",
  "sku_name": "Liquid SKU 001",
  "authenticity_data": [
    {
      "firstAuthenticity": "LIQ001",
      "lastAuthenticity": "LIQ100",
      "rollNumber": "ROLL-001"
    }
  ]
}
```

### Production Device:
```json
{
  "production_type": "device",
  "session_id": "Hikmatul Iman_2_1705123456789",
  "leader_name": "Hikmatul Iman",
  "shift_number": "2",
  "pic": "Operator B",
  "mo_number": "MO-DEVICE-001",
  "sku_name": "Device SKU 001",
  "authenticity_data": [
    {
      "firstAuthenticity": "DEV001",
      "lastAuthenticity": "DEV100",
      "rollNumber": "ROLL-001"
    }
  ]
}
```

### Production Cartridge:
```json
{
  "production_type": "cartridge",
  "session_id": "Farhan Rizky Wahyudi_1_1705123456789",
  "leader_name": "Farhan Rizky Wahyudi",
  "shift_number": "1",
  "pic": "Operator C",
  "mo_number": "MO-CARTRIDGE-001",
  "sku_name": "Cartridge SKU 001",
  "authenticity_data": [
    {
      "firstAuthenticity": "CAR001",
      "lastAuthenticity": "CAR100",
      "rollNumber": "ROLL-001"
    }
  ]
}
```

---

## Catatan Penting:

1. **Multiple Roll Numbers**: Jika `authenticity_data` berisi multiple entries dengan roll number berbeda, setiap entry akan dibuat sebagai baris terpisah di database dengan MO Number yang sama.

2. **Index**: Tabel sudah memiliki index pada:
   - `mo_number` - untuk query cepat berdasarkan MO Number
   - `created_at` - untuk query cepat berdasarkan tanggal
   - `production_type` - untuk filter berdasarkan tipe production

3. **Sync**: Gunakan endpoint `/sync` untuk memindahkan data existing dari tabel production individual ke tabel combined. Data yang sudah ada tidak akan di-duplicate.

