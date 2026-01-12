# Panduan Monitoring Latency Database ke API

Dokumen ini menjelaskan cara menggunakan script untuk mengukur latency antara data yang di-insert ke database PostgreSQL di VPS dan kapan data tersebut muncul di API.

## 📋 Daftar Script

### 1. `monitor-realtime-latency.js` (REKOMENDASI)
Script untuk monitoring real-time yang otomatis mendeteksi data baru dan mengukur latency.

### 2. `monitor-manual-latency.js`
Script untuk check latency secara manual dengan ID tertentu.

---

## 🚀 Cara Menggunakan

### Script 1: Real-Time Monitoring (Rekomendasi)

Script ini akan otomatis memantau data baru yang di-insert ke database dan mengukur latency secara real-time.

#### Syntax:
```bash
node server/monitor-realtime-latency.js [table_name] [duration_seconds]
```

#### Contoh Penggunaan:

1. **Monitor table `production_combined` selama 5 menit (default):**
   ```bash
   node server/monitor-realtime-latency.js production_combined
   ```

2. **Monitor table `production_liquid` selama 10 menit:**
   ```bash
   node server/monitor-realtime-latency.js production_liquid 600
   ```

3. **Monitor table `production_results` selama 1 jam:**
   ```bash
   node server/monitor-realtime-latency.js production_results 3600
   ```

#### Tabel yang Didukung:
- `production_liquid` → `/api/production/liquid`
- `production_device` → `/api/production/device`
- `production_cartridge` → `/api/production/cartridge`
- `production_combined` → `/api/production/combined` (default)
- `production_results` → `/api/production-results`

#### Fitur:
- ✅ Otomatis mendeteksi data baru yang di-insert
- ✅ Mengukur latency secara real-time
- ✅ Statistik lengkap (min, max, average, median, percentile)
- ✅ Distribusi latency (excellent, good, fair, poor)
- ✅ Success rate tracking
- ✅ Progress indicator setiap 30 detik

#### Output Contoh:
```
🔍 Real-Time Latency Monitor
============================
Domain: mpr.moof-set.web.id
Table: production_combined
API Endpoint: /api/production/combined
Monitor Duration: 300 detik (5.0 menit)

📋 Database Configuration:
   Host: localhost
   Port: 5432
   Database: manufacturing_db
   User: admin

🔍 Testing database connection...
✅ Database connection successful!

📊 Monitoring dimulai dari ID: 1234
⏰ Monitor akan berjalan selama 300 detik...

💡 Tips: Insert data baru ke database untuk melihat latency measurement

🆕 Data baru ditemukan! ID: 1235
   📅 Insert Time: 2024-01-15T10:30:45.123Z
   🔍 Mencari di API...
✅ ID 1235 ditemukan di API!
   ⏱️  Latency: 245ms (0.25 detik)
   📅 Insert: 2024-01-15T10:30:45.123Z
   📅 Found: 2024-01-15T10:30:45.368Z
   ✅ Status: BAIK (100-500ms)
```

#### Statistik Final:
```
═══════════════════════════════════════
📊 FINAL STATISTICS
═══════════════════════════════════════
Total Data Inserted: 15
Total Data Found in API: 15
Success Rate: 100.0%
Errors: 0

📈 Latency Statistics:
   Minimum: 120ms (0.12s)
   Maximum: 850ms (0.85s)
   Average: 342ms (0.34s)
   Median: 310ms (0.31s)
   95th Percentile: 720ms (0.72s)
   99th Percentile: 850ms (0.85s)

📊 Latency Distribution:
   ✅ Excellent (< 100ms): 2 (13.3%)
   ✅ Good (100-500ms): 10 (66.7%)
   ⚠️  Fair (500-1000ms): 3 (20.0%)
   ❌ Poor (> 1000ms): 0 (0.0%)
```

---

### Script 2: Manual Latency Check

Script ini untuk check latency data yang sudah ada di database dengan ID tertentu.

#### Syntax:
```bash
node server/monitor-manual-latency.js [table_name] [id_to_check]
```

#### Contoh Penggunaan:

1. **Check latency untuk ID 123 di table `production_combined`:**
   ```bash
   node server/monitor-manual-latency.js production_combined 123
   ```

2. **Check latency untuk ID 456 di table `production_liquid`:**
   ```bash
   node server/monitor-manual-latency.js production_liquid 456
   ```

#### Output Contoh:
```
🔍 Manual Latency Monitor
=========================
Domain: mpr.moof-set.web.id
Table: production_combined
Target ID: 123
API Endpoint: /api/production/combined

📋 Database Configuration:
   Host: localhost
   Port: 5432
   Database: manufacturing_db
   User: admin

🔍 Testing database connection...
✅ Database connection successful!

✅ Data ditemukan di database
   ID: 123
   Created At (DB): 2024-01-15T10:30:45.123Z
   Mencari di API...

✅ Data ditemukan di API!
   Attempt: 3

📊 Latency Measurement:
   ⏱️  Latency dari waktu insert (AKURAT): 245ms (0.25 detik)
   ⏱️  Latency dari start polling: 1200ms (1.20 detik)

📅 Timeline Breakdown:
     - Waktu Insert (DB): 2024-01-15T10:30:45.123Z
     - Waktu Ditemukan (API): 2024-01-15T10:30:45.368Z
     - Total Latency: 245ms (0.25 detik)
   ✅ Status: BAIK (100-500ms)
```

---

## ⚙️ Konfigurasi

### Environment Variables

Script akan menggunakan konfigurasi dari:
1. Environment variables (`.env` file)
2. `config.js` file
3. Default values

#### Variabel yang Digunakan:
- `DB_HOST` - Database host (default: localhost)
- `DB_PORT` - Database port (default: 5432, script akan otomatis mencoba 5433 jika gagal)
- `DB_NAME` - Database name (default: manufacturing_db)
- `DB_USER` - Database user (default: admin)
- `DB_PASSWORD` - Database password (default: Admin123)

**Catatan:** Script akan otomatis mencoba beberapa metode koneksi:
1. Konfigurasi default (dari env/config)
2. Port 5433 (jika port default gagal)
3. Unix socket (jika tersedia)
4. Peer authentication (tanpa password)

### Domain Configuration

Domain default: `mpr.moof-set.web.id`

Untuk mengubah domain, edit baris berikut di script:
```javascript
const domain = 'mpr.moof-set.web.id';
```

---

## 📊 Interpretasi Hasil

### Kategori Latency:

- **✅ Excellent (< 100ms)**: Sangat baik, latency sangat rendah
- **✅ Good (100-500ms)**: Baik, latency dalam batas normal
- **⚠️ Fair (500-1000ms)**: Cukup, masih bisa diterima tapi bisa dioptimasi
- **❌ Poor (> 1000ms)**: Perlu optimasi, latency terlalu tinggi

### Tips Optimasi:

Jika latency tinggi (> 1000ms), cek:
1. **Database Performance**
   - Index pada kolom yang sering di-query
   - Connection pool settings
   - Query optimization

2. **Network Latency**
   - Jarak antara database dan API server
   - Network bandwidth
   - Firewall rules

3. **API Performance**
   - Caching mechanism
   - Query optimization di API endpoint
   - Response time dari API

4. **Server Resources**
   - CPU usage
   - Memory usage
   - Disk I/O

---

## 🔧 Troubleshooting

### Error: Database connection failed / password authentication failed

**Solusi:**
1. Pastikan PostgreSQL berjalan:
   ```bash
   sudo systemctl status postgresql
   ```

2. Check kredensial database di `.env` atau `config.js`

3. **Jika menggunakan port 5433** (bukan default 5432):
   - Script akan otomatis mencoba port 5433 jika port default gagal
   - Atau set manual: `export DB_PORT=5433`
   - Atau edit `.env` file: `DB_PORT=5433`

4. Test koneksi manual:
   ```bash
   # Port default (5432)
   psql -h localhost -U admin -d manufacturing_db
   
   # Port 5433
   psql -h localhost -p 5433 -U admin -d manufacturing_db
   ```

5. Check port PostgreSQL yang aktif:
   ```bash
   sudo netstat -tlnp | grep postgres
   # atau
   sudo ss -tlnp | grep postgres
   ```

### Error: Data tidak ditemukan di API

**Kemungkinan Penyebab:**
1. Data belum di-sync ke API
2. API endpoint tidak tersedia
3. Network issue

**Solusi:**
1. Check API endpoint manual:
   ```bash
   curl https://mpr.moof-set.web.id/api/production/combined
   ```

2. Check server logs untuk error

3. Pastikan data sudah benar-benar di-insert ke database

### Warning: Timestamp di database terlalu lama

**Penyebab:**
- Kolom `created_at` tidak di-set dengan `DEFAULT CURRENT_TIMESTAMP`
- Data yang di-insert adalah data lama

**Solusi:**
1. Pastikan tabel menggunakan `DEFAULT CURRENT_TIMESTAMP`:
   ```sql
   ALTER TABLE production_combined 
   ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;
   ```

2. Atau set manual saat insert:
   ```sql
   INSERT INTO production_combined (..., created_at) 
   VALUES (..., CURRENT_TIMESTAMP);
   ```

---

## 📝 Catatan Penting

1. **Script Real-Time** akan terus berjalan sampai duration habis atau di-interrupt (Ctrl+C)
2. **Script Manual** akan selesai setelah menemukan data atau mencapai max attempts (60 attempts = 30 detik)
3. Pastikan database dan API server dapat diakses dari lokasi script dijalankan
4. Untuk monitoring jangka panjang, gunakan script real-time dengan duration yang lebih lama
5. Statistik akan ditampilkan di akhir monitoring atau saat di-interrupt

---

## 🎯 Best Practices

1. **Untuk Testing Awal**: Gunakan script manual dengan ID yang sudah diketahui
2. **Untuk Monitoring Production**: Gunakan script real-time dengan duration yang sesuai
3. **Untuk Performance Analysis**: Jalankan script real-time selama periode peak usage
4. **Untuk Troubleshooting**: Gunakan script manual untuk check data spesifik yang bermasalah

---

## 📞 Support

Jika ada masalah atau pertanyaan:
1. Check log output untuk error messages
2. Pastikan semua dependencies terinstall (`npm install`)
3. Verify database dan API configuration
4. Check network connectivity ke VPS
