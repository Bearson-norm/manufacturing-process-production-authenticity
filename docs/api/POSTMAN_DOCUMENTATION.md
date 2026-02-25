# Dokumentasi Postman - Get Semua MO Selesai per Tanggal

## Ringkasan
Dokumentasi singkat untuk mendapatkan **semua** Manufacturing Order (MO) yang selesai pada tanggal tertentu. **Tidak perlu menyebutkan mo_number**, endpoint ini akan mengembalikan semua MO yang selesai pada tanggal yang ditentukan.

## Cara Import
1. Buka Postman
2. Klik **Import** di pojok kiri atas
3. Pilih file `postman.collection.json`
4. Collection akan otomatis terimport dengan semua variabel dan konfigurasi

## Endpoint
```
GET {{base_url}}/api/external/manufacturing-data/by-date
```

## Parameter Query
- `completed_at` (Required): Tanggal selesai dalam format `YYYY-MM-DD` (contoh: `2024-01-15`)

**Catatan:** Endpoint ini **tidak memerlukan** parameter `mo_number`. Semua MO yang selesai pada tanggal tersebut akan dikembalikan.

## Header
- `X-API-Key`: API Key untuk autentikasi
- `Content-Type`: `application/json`

## Variabel Postman
Setelah import, atur variabel berikut di Postman:
- `base_url`: Base URL API (default: `http://localhost:1234`)
- `api_key`: API Key untuk autentikasi
- `target_date`: Tanggal dalam format `YYYY-MM-DD` (otomatis di-set ke hari ini)

## Contoh Request
```
GET {{base_url}}/api/external/manufacturing-data/by-date?completed_at=2024-01-15
```

**Header:**
```
X-API-Key: your-api-key-here
Content-Type: application/json
```

## Contoh Response (Success)
```json
{
    "success": true,
    "completed_at": "2024-01-15",
    "total_mo": 3,
    "total_sessions": 5,
    "data": [
        {
            "mo_number": "MO001",
            "total_sessions": 2,
            "sessions": [
                {
                    "session": "session_1234567890",
                    "leader": "John Doe",
                    "shift": "1",
                    "mo_data": [
                        {
                            "mo_number": "MO001",
                            "sku_name": "Product A",
                            "pic": "PIC001",
                            "production_type": "liquid",
                            "completed_at": "2024-01-15T10:30:00.000Z",
                            "authenticity_data": [...],
                            "buffered_auth": [],
                            "rejected_auth": []
                        }
                    ]
                }
            ]
        },
        {
            "mo_number": "MO002",
            "total_sessions": 1,
            "sessions": [...]
        }
    ]
}
```

## Response Fields
- `success`: Status keberhasilan request
- `completed_at`: Tanggal yang digunakan untuk filter
- `total_mo`: Jumlah total MO yang selesai pada tanggal tersebut
- `total_sessions`: Jumlah total session untuk semua MO
- `data`: Array berisi data semua MO yang selesai, dikelompokkan per MO number

## Catatan
- Format tanggal: `YYYY-MM-DD` (contoh: `2024-01-15`)
- Variable `target_date` otomatis di-set ke tanggal hari ini saat request dijalankan
- Endpoint ini mengembalikan **semua MO** yang selesai pada tanggal tertentu tanpa perlu menyebutkan mo_number
- Data dikelompokkan per MO number, kemudian per session
