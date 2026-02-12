# Development Startup Guide

## Menjalankan dengan `npm run dev`

Saat menjalankan `npm run dev`, sistem akan:
1. Menjalankan server backend (nodemon) di port 1234
2. Menjalankan client frontend (React) di port 3000
3. Keduanya berjalan secara bersamaan menggunakan `concurrently`

## Apa yang Harus Anda Lihat

### 1. Database Configuration (Muncul di Server Log)

Saat server start, Anda akan melihat:

```
============================================================
📊 DATABASE CONFIGURATION
============================================================
   Host: localhost
   Port: 5432
   Database: Staging_Manufacturing_Order
   User: admin
   Password: ***
============================================================

🔄 Initializing PostgreSQL tables...
📦 Target database: Staging_Manufacturing_Order
✅ Connected to correct database: "Staging_Manufacturing_Order"
✅ PostgreSQL tables initialized successfully
📋 Total tables in database: 15
📊 Tables found:
   1. admin_config
   2. buffer_cartridge
   3. buffer_device
   4. buffer_liquid
   5. odoo_mo_cache
   6. pic_list
   7. production_cartridge
   8. production_combined
   9. production_device
   10. production_liquid
   11. production_results
   12. receiver_logs
   13. reject_cartridge
   14. reject_device
   15. reject_liquid

📈 Database Data Summary:
   pic_list: 113 records

✅ Database initialized and ready
🚀 Server starting...

🚀 Server is running on port 1234
📡 Environment: development
🔗 Access at: http://localhost:1234
```

### 2. Client Log (React)

Anda akan melihat output dari React development server:

```
Compiled successfully!

You can now view manufacturing-client in the browser.

  Local:            http://localhost:3000
  On Your Network:  http://192.168.x.x:3000
```

## Memverifikasi Database yang Digunakan

### Cara 1: Lihat Log saat Startup

Perhatikan bagian **"📊 DATABASE CONFIGURATION"** di console output server. Database yang digunakan akan ditampilkan di sana.

### Cara 2: Jalankan Script Check Database

Buka terminal baru dan jalankan:

```bash
cd server
node check-database.js
```

Ini akan menampilkan:
- Database yang sedang digunakan
- Semua tabel yang ada
- Jumlah data di setiap tabel

### Cara 3: Cek File Konfigurasi

1. **Cek `.env` file** (jika ada di root project):
   ```env
   DB_NAME=your_database_name
   ```

2. **Cek `server/config.js`**:
   ```javascript
   database: {
     database: process.env.DB_NAME || 'manufacturing_db', // Default
     // ...
   }
   ```

## Mengubah Database

### Jika ingin menggunakan database yang berbeda:

1. **Buat file `.env`** di root project:
   ```env
   DB_NAME=manufacturing_db
   DB_HOST=localhost
   DB_PORT=5432
   DB_USER=admin
   DB_PASSWORD=Admin123
   ```

2. **Restart server** (stop dengan Ctrl+C, lalu `npm run dev` lagi)

3. **Verifikasi** dengan melihat log startup atau jalankan `node server/check-database.js`

## Troubleshooting

### Database tidak muncul di log

Jika tidak melihat database configuration di log:
- Pastikan `server/database.js` sudah di-require dengan benar
- Cek apakah ada error di console
- Pastikan PostgreSQL service berjalan

### Database yang salah

Jika melihat database yang tidak diinginkan:
1. Cek file `.env` (jika ada)
2. Cek `server/config.js` untuk default value
3. Pastikan environment variable `DB_NAME` di-set dengan benar
4. Restart server setelah mengubah konfigurasi

### Error "database does not exist"

```
Error: database "xxx" does not exist
```

**Solusi:**
```sql
-- Login ke PostgreSQL
psql -U admin -h localhost

-- Buat database
CREATE DATABASE your_database_name;
```

### Concurrently output tidak jelas

Jika output dari `concurrently` tidak jelas karena server dan client bercampur:

1. **Jalankan server saja:**
   ```bash
   npm run server
   ```

2. **Atau jalankan client saja:**
   ```bash
   npm run client
   ```

3. **Atau gunakan prefix di concurrently** (edit `package.json`):
   ```json
   "dev": "concurrently -n \"SERVER,CLIENT\" -c \"blue,green\" \"npm run server\" \"npm run client\""
   ```

## Tips

- **Selalu cek log startup** untuk memastikan database yang benar digunakan
- **Gunakan `check-database.js`** untuk verifikasi cepat
- **Simpan konfigurasi di `.env`** untuk kemudahan pengelolaan
- **Jangan commit `.env`** ke git (tambahkan ke `.gitignore`)
