# Database Setup Guide

## Current Database Configuration

Sistem menggunakan PostgreSQL sebagai database. Konfigurasi database dapat diatur melalui:

1. **Environment Variables** (file `.env` di root project)
2. **Default values** di `server/config.js`

## Konfigurasi Database

### Environment Variables

Buat file `.env` di root project dengan konfigurasi berikut:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=manufacturing_db
DB_USER=admin
DB_PASSWORD=Admin123
```

### Default Configuration

Jika tidak ada file `.env`, sistem akan menggunakan default dari `server/config.js`:

```javascript
database: {
  host: 'localhost',
  port: 5432,
  database: 'manufacturing_db',  // Default database name
  user: 'admin',
  password: 'Admin123',
}
```

## Memeriksa Database yang Digunakan

### 1. Jalankan Script Check Database

```bash
cd server
node check-database.js
```

Script ini akan menampilkan:
- Database yang sedang digunakan
- Daftar semua tabel
- Jumlah data di setiap tabel
- Status tabel yang diharapkan

### 2. Cek Log saat Server Start

Saat server start, akan menampilkan informasi database:

```
📊 Database Configuration:
   Host: localhost
   Port: 5432
   Database: manufacturing_db
   User: admin
   Password: ***
```

## Mengubah Database

### Opsi 1: Menggunakan Environment Variable

1. Buat file `.env` di root project
2. Set `DB_NAME` ke database yang diinginkan:

```env
DB_NAME=your_database_name
```

3. Restart server

### Opsi 2: Mengubah Default di config.js

Edit `server/config.js`:

```javascript
database: {
  database: process.env.DB_NAME || 'your_database_name', // Ganti default
  // ...
}
```

## Membuat Database Baru

Jika database belum ada, buat terlebih dahulu:

```sql
-- Login ke PostgreSQL
psql -U admin -h localhost

-- Buat database baru
CREATE DATABASE manufacturing_db;

-- Atau dengan encoding khusus
CREATE DATABASE manufacturing_db 
  WITH ENCODING='UTF8' 
  LC_COLLATE='en_US.UTF-8' 
  LC_CTYPE='en_US.UTF-8';
```

## Memastikan Database Kosong

Jika ingin memastikan database kosong:

1. **Cek data yang ada:**
   ```bash
   cd server
   node check-database.js
   ```

2. **Hapus semua data (HATI-HATI!):**
   ```sql
   -- Hapus semua data tapi tetap tabel
   TRUNCATE TABLE production_liquid, production_device, production_cartridge,
                production_combined, production_results,
                buffer_liquid, buffer_device, buffer_cartridge,
                reject_liquid, reject_device, reject_cartridge,
                odoo_mo_cache, receiver_logs CASCADE;
   
   -- Reset admin_config (opsional)
   DELETE FROM admin_config;
   
   -- Reset pic_list ke default (opsional)
   DELETE FROM pic_list;
   ```

3. **Atau drop dan recreate database:**
   ```sql
   DROP DATABASE manufacturing_db;
   CREATE DATABASE manufacturing_db;
   ```

## Troubleshooting

### Database tidak ditemukan

```
Error: database "manufacturing_db" does not exist
```

**Solusi:** Buat database terlebih dahulu:
```sql
CREATE DATABASE manufacturing_db;
```

### Koneksi ditolak

```
Error: connect ECONNREFUSED
```

**Solusi:**
1. Pastikan PostgreSQL service berjalan
2. Cek host dan port di konfigurasi
3. Cek firewall settings

### Wrong database

Jika terhubung ke database yang salah:

1. Cek file `.env` atau environment variables
2. Pastikan `DB_NAME` sesuai dengan database yang diinginkan
3. Restart server setelah mengubah konfigurasi

## Verifikasi

Setelah mengubah konfigurasi, verifikasi dengan:

```bash
cd server
node check-database.js
```

Pastikan output menunjukkan database yang benar.
