# Odoo MO Time Range API - Postman Collection

Postman Collection untuk mendapatkan nomor Manufacturing Order (MO) dari Odoo API berdasarkan rentang waktu menggunakan POST API.

## 📋 Daftar Isi

- [Instalasi](#instalasi)
- [Konfigurasi](#konfigurasi)
- [Request yang Tersedia](#request-yang-tersedia)
- [Cara Penggunaan](#cara-penggunaan)
- [Format Tanggal](#format-tanggal)
- [Response Format](#response-format)
- [Contoh Response](#contoh-response)

## 🚀 Instalasi

1. Buka Postman
2. Klik **Import** di pojok kiri atas
3. Pilih file `Odoo_MO_TimeRange_API.postman_collection.json`
4. Collection akan muncul di sidebar kiri

## ⚙️ Konfigurasi

Sebelum menggunakan collection, set variable berikut:

### Collection Variables

1. **`odoo_base_url`**
   - Default: `https://foomx.odoo.com`
   - Base URL Odoo API Anda

2. **`odoo_session_id`**
   - Default: `bc6b1450c0cd3b05e3ac199521e02f7b639e39ae`
   - Session ID Odoo (dapat dari cookie setelah login ke Odoo)
   - **Cara mendapatkan:**
     - Login ke Odoo
     - Buka Developer Tools (F12)
     - Tab Application/Storage > Cookies
     - Cari cookie `session_id`
     - Copy value-nya

3. **`start_date`**
   - Format: `YYYY-MM-DD HH:MM:SS`
   - Contoh: `2026-01-01 00:00:00`
   - Tanggal mulai rentang waktu

4. **`end_date`**
   - Format: `YYYY-MM-DD HH:MM:SS`
   - Contoh: `2026-01-31 23:59:59`
   - Tanggal akhir rentang waktu

5. **`note_filter`** (optional)
   - Contoh: `cartridge`, `liquid`, `device`
   - Filter berdasarkan note (case-insensitive)

### Cara Set Variable

1. Klik kanan pada collection **"Odoo MO - Get by Time Range"**
2. Pilih **Edit**
3. Tab **Variables**
4. Edit value sesuai kebutuhan
5. Klik **Save**

## 📡 Request yang Tersedia

### 1. Get MO by Date Range (Start & End)
Mendapatkan semua MO dalam rentang waktu tertentu.

**Filter:**
- `create_date >= start_date`
- `create_date <= end_date`

**Gunakan untuk:** Query MO dalam periode tertentu (misal: 1 Januari - 31 Januari 2026)

---

### 2. Get MO from Start Date (No End Date)
Mendapatkan semua MO dari tanggal tertentu sampai sekarang.

**Filter:**
- `create_date >= start_date`

**Gunakan untuk:** Semua MO dari tanggal tertentu ke depan

---

### 3. Get MO Last 7 Days
Mendapatkan semua MO dari 7 hari terakhir.

**Fitur:**
- Auto-calculate tanggal 7 hari yang lalu
- Tidak perlu set `start_date` manual

**Gunakan untuk:** Monitoring MO mingguan

---

### 4. Get MO Last 30 Days
Mendapatkan semua MO dari 30 hari terakhir.

**Fitur:**
- Auto-calculate tanggal 30 hari yang lalu
- Tidak perlu set `start_date` manual

**Gunakan untuk:** Laporan bulanan

---

### 5. Get MO by Date Range with Note Filter
Mendapatkan MO berdasarkan rentang waktu DAN filter note.

**Filter:**
- `create_date >= start_date`
- `create_date <= end_date`
- `note` mengandung text tertentu (case-insensitive)

**Contoh penggunaan:**
- Set `note_filter` = `"cartridge"` untuk MO cartridge
- Set `note_filter` = `"liquid"` untuk MO liquid
- Set `note_filter` = `"device"` untuk MO device

---

### 6. Get MO Numbers Only (Extract)
Mendapatkan HANYA nomor MO (field `name`) dalam rentang waktu.

**Fitur:**
- Hanya return field `name`
- Lebih cepat karena tidak fetch field lain
- Auto-extract MO numbers ke environment variable

**Gunakan untuk:** Hanya perlu list nomor MO, tidak perlu detail

## 📝 Cara Penggunaan

### Contoh 1: Get MO dari 1-31 Januari 2026

1. Set variable:
   - `start_date`: `2026-01-01 00:00:00`
   - `end_date`: `2026-01-31 23:59:59`

2. Jalankan request: **"1. Get MO by Date Range (Start & End)"**

3. Response akan berisi semua MO yang dibuat antara 1-31 Januari 2026

---

### Contoh 2: Get MO Cartridge dari 7 hari terakhir

1. Set variable:
   - `note_filter`: `cartridge`

2. Jalankan request: **"3. Get MO Last 7 Days"**

3. Response akan berisi MO cartridge dari 7 hari terakhir

---

### Contoh 3: Get hanya nomor MO (tanpa detail)

1. Set variable:
   - `start_date`: `2026-01-01 00:00:00`
   - `end_date`: `2026-01-31 23:59:59`

2. Jalankan request: **"6. Get MO Numbers Only (Extract)"**

3. Response hanya berisi field `name` (nomor MO)
4. MO numbers juga tersimpan di environment variable `mo_numbers`

## 📅 Format Tanggal

Format yang digunakan: **`YYYY-MM-DD HH:MM:SS`**

### Contoh:
- `2026-01-01 00:00:00` - 1 Januari 2026, jam 00:00:00
- `2026-01-31 23:59:59` - 31 Januari 2026, jam 23:59:59
- `2026-12-25 12:30:00` - 25 Desember 2026, jam 12:30:00

### Tips:
- Gunakan `00:00:00` untuk awal hari
- Gunakan `23:59:59` untuk akhir hari
- Timezone mengikuti Odoo server (biasanya UTC)

## 📦 Response Format

### Success Response

```json
{
  "jsonrpc": "2.0",
  "id": null,
  "result": [
    {
      "id": 12345,
      "name": "PROD/MO/29884",
      "product_id": [456, "Product Name"],
      "product_qty": 1000,
      "product_uom_id": [1, "Units"],
      "note": "TEAM CARTRIDGE",
      "create_date": "2026-01-15 08:30:00",
      "state": "confirmed"
    },
    ...
  ]
}
```

### Error Response

```json
{
  "jsonrpc": "2.0",
  "id": null,
  "error": {
    "code": 200,
    "message": "Access Denied",
    "data": {
      "name": "odoo.exceptions.AccessDenied",
      "message": "Access Denied",
      "arguments": ["Access Denied"]
    }
  }
}
```

## 🔍 Field yang Dikembalikan

| Field | Type | Deskripsi |
|-------|------|-----------|
| `id` | Integer | ID internal Odoo |
| `name` | String | Nomor MO (e.g., PROD/MO/29884) |
| `product_id` | Array | [id, name] produk |
| `product_qty` | Float | Quantity produk |
| `product_uom_id` | Array | [id, name] unit of measure |
| `note` | String | Catatan MO |
| `create_date` | String | Tanggal pembuatan MO (format: YYYY-MM-DD HH:MM:SS) |
| `state` | String | Status MO (draft, confirmed, progress, done, cancel) |

## ⚠️ Troubleshooting

### Error: "Access Denied"
- **Penyebab:** Session ID tidak valid atau expired
- **Solusi:** 
  1. Login ulang ke Odoo
  2. Ambil session_id baru dari cookie
  3. Update variable `odoo_session_id`

### Error: "No results"
- **Penyebab:** Tidak ada MO dalam rentang waktu yang diminta
- **Solusi:** 
  1. Periksa rentang tanggal
  2. Coba rentang yang lebih luas
  3. Pastikan MO ada di Odoo

### Error: "Connection timeout"
- **Penyebab:** Odoo server tidak dapat diakses
- **Solusi:** 
  1. Periksa koneksi internet
  2. Periksa `odoo_base_url` benar
  3. Coba akses Odoo via browser

### Response kosong tapi tidak error
- **Penyebab:** Filter terlalu ketat atau tidak ada data
- **Solusi:** 
  1. Hapus filter note (jika menggunakan)
  2. Perluas rentang tanggal
  3. Cek di Odoo apakah MO ada

## 📚 Referensi

- Odoo API Documentation: https://www.odoo.com/documentation/
- JSON-RPC 2.0 Specification: https://www.jsonrpc.org/specification
- Odoo Model: `mrp.production` (Manufacturing Order)

## 🔐 Security Notes

- **Jangan commit session_id ke repository public**
- Session ID akan expire setelah beberapa waktu
- Gunakan environment variables untuk production
- Rotate session ID secara berkala

## 📞 Support

Jika ada masalah atau pertanyaan:
1. Periksa log di Odoo server
2. Periksa Postman Console untuk detail error
3. Pastikan semua variable sudah di-set dengan benar

---

**Created:** 2026  
**Version:** 1.0.0  
**Collection ID:** odoo-mo-timerange-001
