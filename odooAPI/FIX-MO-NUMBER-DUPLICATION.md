# Fix: Duplikasi MO Number di API Response

## Masalah
Pada API endpoint `/api/external/manufacturing-data/by-date`, terdapat duplikasi `mo_number`:
- `mo_number` muncul di level parent (dalam array `data`)
- `mo_number` juga muncul di dalam `mo_data`

### Struktur Lama (Sebelum Fix)
```json
{
  "success": true,
  "completed_at": "2026-01-07",
  "total_mo": 6,
  "total_sessions": 6,
  "data": [
    {
      "mo_number": "PROD/MO/28800",  // ❌ Duplikasi di sini
      "total_sessions": 1,
      "sessions": [
        {
          "session": "Ilyas Safiq_2_1766652752790",
          "leader": "Ilyas Safiq",
          "shift": "2",
          "mo_data": [
            {
              "mo_number": "PROD/MO/28800",  // ✅ MO Number yang sebenarnya
              "sku_name": "FOOM AVOCADO SHAKE",
              "pic": "Iendah",
              ...
            }
          ]
        }
      ]
    }
  ]
}
```

## Solusi
Menghapus `mo_number` dari level parent, karena informasi ini sudah tersedia di dalam `mo_data`.

### Struktur Baru (Setelah Fix)
```json
{
  "success": true,
  "completed_at": "2026-01-07",
  "total_mo": 6,
  "total_sessions": 6,
  "data": [
    {
      "total_sessions": 1,  // ✅ mo_number dihapus dari parent
      "sessions": [
        {
          "session": "Ilyas Safiq_2_1766652752790",
          "leader": "Ilyas Safiq",
          "shift": "2",
          "mo_data": [
            {
              "mo_number": "PROD/MO/28800",  // ✅ MO Number hanya ada di sini
              "sku_name": "FOOM AVOCADO SHAKE",
              "pic": "Iendah",
              "production_type": "liquid",
              "completed_at": "2026-01-07T04:48:01.459Z",
              "authenticity_data": [
                {
                  "first_authenticity": "317891897",
                  "last_authenticity": "317896897",
                  "roll_number": "1"
                }
              ],
              "buffered_auth": [],
              "rejected_auth": []
            }
          ]
        }
      ]
    }
  ]
}
```

## Perubahan yang Dilakukan

### 1. Server Code (`server/index.js`)

#### Baris 1372-1389: Menambahkan `mo_number` ke dalam `mo_data`
```javascript
// Add production data
moGroups[moNumber].sessions[sessionKey].mo_data.push({
  mo_number: row.mo_number,  // ✅ Ditambahkan
  sku_name: row.sku_name,
  pic: row.pic,
  production_type: row.production_type,
  completed_at: row.completed_at || null,
  authenticity_data: row.authenticity_data.map(auth => ({
    first_authenticity: auth.firstAuthenticity || '',
    last_authenticity: auth.lastAuthenticity || '',
    roll_number: auth.rollNumber || ''
  })),
  buffered_auth: allBuffers
    .filter(b => b.mo_number === row.mo_number)
    .flatMap(b => b.authenticity_numbers),
  rejected_auth: allRejects
    .filter(r => r.mo_number === row.mo_number)
    .flatMap(r => r.authenticity_numbers)
});
```

#### Baris 1392-1396: Menghapus `mo_number` dari parent level
```javascript
// Convert to array format
const result = Object.values(moGroups).map(moGroup => ({
  // mo_number: moGroup.mo_number,  // ❌ Dihapus
  total_sessions: Object.keys(moGroup.sessions).length,
  sessions: Object.values(moGroup.sessions)
}));
```

### 2. Postman Collection (`API-Report-Authenticity.postman_collection.json`)

Example response di Postman collection telah diupdate untuk mencerminkan struktur baru tanpa `mo_number` di parent level.

## Keuntungan Perubahan

1. **✅ Menghilangkan duplikasi data**: Data lebih bersih dan tidak redundan
2. **✅ Struktur lebih konsisten**: MO Number hanya muncul di satu tempat yang logis (dalam mo_data)
3. **✅ Lebih mudah di-parse**: Aplikasi client tidak perlu khawatir dengan inkonsistensi
4. **✅ Mengurangi ukuran payload**: Response JSON lebih kecil tanpa data duplikat

## Migration Guide untuk Client

Jika aplikasi client Anda sudah menggunakan endpoint ini, berikut cara mengupdate kode:

### Sebelum (Kode Lama)
```javascript
// Mengakses MO Number dari parent level
response.data.forEach(moGroup => {
  const moNumber = moGroup.mo_number;  // ❌ Tidak ada lagi
  console.log(`Processing MO: ${moNumber}`);
  
  moGroup.sessions.forEach(session => {
    session.mo_data.forEach(mo => {
      // Process mo_data
    });
  });
});
```

### Sesudah (Kode Baru)
```javascript
// Mengakses MO Number dari mo_data
response.data.forEach(moGroup => {
  moGroup.sessions.forEach(session => {
    session.mo_data.forEach(mo => {
      const moNumber = mo.mo_number;  // ✅ Ambil dari sini
      console.log(`Processing MO: ${moNumber}`);
      // Process mo_data
    });
  });
});
```

### Alternatif: Backward Compatible Check
Jika Anda ingin mendukung kedua struktur (lama dan baru) selama masa transisi:

```javascript
response.data.forEach(moGroup => {
  // Try to get mo_number from parent (old structure)
  let moNumber = moGroup.mo_number;
  
  moGroup.sessions.forEach(session => {
    session.mo_data.forEach(mo => {
      // If not in parent, get from mo_data (new structure)
      if (!moNumber) {
        moNumber = mo.mo_number;
      }
      
      console.log(`Processing MO: ${moNumber}`);
      // Process mo_data
    });
  });
});
```

## Testing

### Request
```bash
curl -X GET "http://localhost:1234/api/external/manufacturing-data/by-date?completed_at=2026-01-07" \
  -H "X-API-Key: your-api-key-here"
```

### Expected Response
```json
{
  "success": true,
  "completed_at": "2026-01-07",
  "total_mo": 6,
  "total_sessions": 6,
  "data": [
    {
      "total_sessions": 1,
      "sessions": [
        {
          "session": "...",
          "leader": "...",
          "shift": "...",
          "mo_data": [
            {
              "mo_number": "PROD/MO/28800",
              "sku_name": "...",
              "pic": "...",
              ...
            }
          ]
        }
      ]
    }
  ]
}
```

## Catatan
- Field `total_mo` di root response masih menunjukkan jumlah MO yang unik
- Field `total_sessions` di root response menunjukkan total semua sessions
- Field `total_sessions` di dalam setiap item array `data` menunjukkan jumlah sessions untuk MO tersebut
- MO Number tetap bisa diakses dari dalam `mo_data` array

## Rollback (Jika Diperlukan)

Jika perlu rollback ke struktur lama, ubah di `server/index.js` baris 1392-1396:

```javascript
// Rollback: tambahkan kembali mo_number di parent
const result = Object.values(moGroups).map(moGroup => ({
  mo_number: moGroup.mo_number,  // Uncomment ini
  total_sessions: Object.keys(moGroup.sessions).length,
  sessions: Object.values(moGroup.sessions)
}));
```

## Endpoint yang Terpengaruh

✅ `/api/external/manufacturing-data/by-date` - **Sudah diperbaiki**

Endpoint lain tidak terpengaruh karena memiliki struktur response yang berbeda.

