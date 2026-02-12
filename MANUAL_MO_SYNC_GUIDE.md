# Manual MO Sync dari Odoo - Panduan

## Endpoint untuk Manual Sync MO

Sistem menyediakan endpoint untuk melakukan **manual sync MO dari Odoo** ke database lokal tanpa menunggu scheduler (yang berjalan setiap 6 jam).

## Endpoint

### POST `/api/admin/sync-mo`

**URL:** `http://localhost:1234/api/admin/sync-mo`

**Method:** `POST`

**Headers:**
```
Content-Type: application/json
```

**Body:** (kosong atau tidak perlu)

## Cara Menggunakan

### 1. Menggunakan Browser (via Admin Panel)

Jika ada tombol di Admin Panel, klik tombol "Sync MO from Odoo"

### 2. Menggunakan cURL

```bash
curl -X POST http://localhost:1234/api/admin/sync-mo
```

### 3. Menggunakan PowerShell

```powershell
Invoke-RestMethod -Uri "http://localhost:1234/api/admin/sync-mo" -Method POST
```

### 4. Menggunakan Postman

1. Buat request baru
2. Method: `POST`
3. URL: `http://localhost:1234/api/admin/sync-mo`
4. Klik Send

### 5. Menggunakan JavaScript/Fetch

```javascript
fetch('http://localhost:1234/api/admin/sync-mo', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
})
.then(response => response.json())
.then(data => {
  console.log('Sync result:', data);
})
.catch(error => {
  console.error('Error:', error);
});
```

## Response

### Success Response

```json
{
  "success": true,
  "message": "MO sync completed successfully",
  "totalUpdated": 150,
  "results": [
    {
      "production_type": "liquid",
      "updated": 50,
      "status": "success"
    },
    {
      "production_type": "device",
      "updated": 60,
      "status": "success"
    },
    {
      "production_type": "cartridge",
      "updated": 40,
      "status": "success"
    }
  ],
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Error Response

```json
{
  "success": false,
  "error": "Odoo configuration is missing. Please configure Odoo Session ID and Base URL in Admin settings."
}
```

## Apa yang Dilakukan Endpoint Ini?

1. **Mengambil konfigurasi Odoo** dari database (Session ID dan Base URL)
2. **Memanggil Odoo API** untuk setiap production type (liquid, device, cartridge)
3. **Mengambil MO data** dari 30 hari terakhir
4. **Menyimpan ke database** `odoo_mo_cache` dengan:
   - Update jika MO sudah ada (berdasarkan `mo_number`)
   - Insert jika MO baru
5. **Mengembalikan hasil** berupa jumlah MO yang di-update per production type

## Catatan Penting

### Prasyarat

1. **Odoo Configuration harus sudah di-set:**
   - Session ID Odoo
   - Odoo Base URL
   
   Dapat di-set melalui Admin Panel: `http://localhost:1234/admin`

2. **Database harus sudah terhubung** dan tabel `odoo_mo_cache` sudah ada

### Data yang Di-sync

- **Production Types:** liquid, device, cartridge
- **Date Range:** 30 hari terakhir dari tanggal saat ini
- **Limit:** Maksimal 1000 MO per production type

### Update vs Insert

- Jika MO number sudah ada di cache → **UPDATE** data (sku_name, quantity, uom, note, create_date, last_updated)
- Jika MO number belum ada → **INSERT** data baru

## Troubleshooting

### Error: "Odoo configuration is missing"

**Solusi:**
1. Buka Admin Panel: `http://localhost:1234/admin`
2. Isi Odoo Session ID dan Odoo Base URL
3. Klik "Save Configuration"
4. Coba sync lagi

### Error: "Request timeout"

**Solusi:**
- Cek koneksi internet
- Pastikan Odoo API dapat diakses
- Cek Session ID masih valid

### Error: "Odoo API error"

**Solusi:**
- Cek Session ID di Admin Panel
- Pastikan Session ID masih aktif (tidak expired)
- Cek Odoo Base URL benar

### Tidak ada data yang di-update

**Kemungkinan:**
- Tidak ada MO baru dalam 30 hari terakhir
- Filter production type tidak match dengan data di Odoo
- Cek log di console server untuk detail error

## Perbandingan dengan Scheduler

| Feature | Manual Sync | Scheduler |
|---------|-------------|-----------|
| Trigger | Manual (via API) | Otomatis setiap 6 jam |
| Waktu | Kapan saja | 00:00, 06:00, 12:00, 18:00 |
| Response | Langsung dapat hasil | Tidak ada response |
| Use Case | Testing, urgent update | Regular sync |

## Contoh Penggunaan di Production

```bash
# Sync MO sebelum production dimulai
curl -X POST http://localhost:1234/api/admin/sync-mo

# Cek hasil
curl http://localhost:1234/api/admin/mo-stats
```

## Monitoring

Setelah sync, Anda bisa cek:
- **MO Stats:** `GET /api/admin/mo-stats`
- **MO List dari Cache:** `GET /api/search/mo?q=MO-001`
- **MO List dari Odoo (real-time):** `GET /api/odoo/mo-list`
