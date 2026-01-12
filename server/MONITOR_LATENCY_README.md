# Panduan Monitor Latency dengan DBeaver

## Cara Menggunakan

### 1. Pastikan Environment Variables Sudah Benar

Script akan otomatis mencoba beberapa metode koneksi, tapi lebih baik pastikan `.env` sudah benar:

```bash
# Check current .env
cat .env | grep DB_

# Atau set manual sebelum run:
export DB_HOST=localhost
export DB_PORT=5432  # atau 5433
export DB_USER=admin
export DB_PASSWORD=Admin123
export DB_NAME=manufacturing_db
```

### 2. Jika Password Authentication Gagal

**Opsi A: Gunakan Unix Socket (Recommended untuk VPS)**
```bash
export DB_HOST=/var/run/postgresql
node monitor-manual-latency.js production_liquid 13
```

**Opsi B: Check Port PostgreSQL**
```bash
# Check port yang digunakan
sudo netstat -tlnp | grep postgres
# atau
sudo ss -tlnp | grep postgres

# Jika port 5433, set:
export DB_PORT=5433
node monitor-manual-latency.js production_liquid 13
```

**Opsi C: Test Connection Manual**
```bash
# Test dengan psql
PGPASSWORD=Admin123 psql -h localhost -p 5432 -U admin -d manufacturing_db -c "SELECT 1"

# Jika gagal, coba port 5433
PGPASSWORD=Admin123 psql -h localhost -p 5433 -U admin -d manufacturing_db -c "SELECT 1"

# Jika masih gagal, coba Unix socket
sudo -u postgres psql -d manufacturing_db -c "SELECT 1"
```

### 3. Jalankan Script

```bash
# Basic usage
node monitor-manual-latency.js production_liquid 13

# Script akan:
# 1. Mencoba connect ke database dengan beberapa metode
# 2. Mencari data dengan ID yang diberikan
# 3. Polling API sampai data muncul
# 4. Menampilkan latency
```

### 4. Workflow Lengkap dengan DBeaver

1. **Jalankan script monitoring:**
   ```bash
   node monitor-manual-latency.js production_liquid 0
   # (ID 0 akan error, tapi script akan ready untuk monitoring)
   ```

2. **Buka DBeaver dan insert data:**
   ```sql
   INSERT INTO production_liquid (
     session_id, leader_name, shift_number, pic, 
     mo_number, sku_name, authenticity_data
   ) VALUES (
     'test-session-' || extract(epoch from now()), 
     'Test Leader', '1', 'Test PIC', 
     'MO-TEST-001', 'Test SKU', '["123456"]'
   ) RETURNING id;
   ```

3. **Catat ID yang muncul, lalu jalankan:**
   ```bash
   node monitor-manual-latency.js production_liquid <ID_YANG_DICATAT>
   ```

## Troubleshooting

### Error: "password authentication failed"

**Solusi 1: Gunakan Unix Socket**
```bash
export DB_HOST=/var/run/postgresql
node monitor-manual-latency.js production_liquid 13
```

**Solusi 2: Check Password**
```bash
# Check user di PostgreSQL
sudo -u postgres psql -c "\du admin"

# Reset password jika perlu
sudo -u postgres psql -c "ALTER USER admin WITH PASSWORD 'Admin123';"
```

**Solusi 3: Check pg_hba.conf**
```bash
# Check authentication method
sudo -u postgres psql -c "SHOW hba_file;"
sudo cat $(sudo -u postgres psql -tAc "SHOW hba_file;") | grep -v "^#"
```

### Error: "Connection refused"

**Check PostgreSQL Status:**
```bash
sudo systemctl status postgresql
sudo systemctl start postgresql  # jika tidak running
```

**Check Port:**
```bash
sudo netstat -tlnp | grep postgres
# Update DB_PORT sesuai port yang digunakan
```

### Data Tidak Muncul di API

1. **Check apakah server masih running:**
   ```bash
   curl https://mpr.moof-set.web.id/health
   ```

2. **Check endpoint yang benar:**
   - `production_liquid` → `/api/production/liquid`
   - `production_device` → `/api/production/device`
   - `production_cartridge` → `/api/production/cartridge`
   - `production_combined` → `/api/production/combined`

3. **Check data di database:**
   ```sql
   SELECT id, created_at FROM production_liquid WHERE id = 13;
   ```

## Tips

- Script akan otomatis mencoba beberapa metode koneksi
- Jika semua gagal, script akan memberikan tips untuk troubleshooting
- Untuk test yang lebih akurat, insert data beberapa kali dan ambil average latency
- Latency normal: < 100ms (sangat baik), 100-500ms (baik), > 1000ms (perlu optimasi)
