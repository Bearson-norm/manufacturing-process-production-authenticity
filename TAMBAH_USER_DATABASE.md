# 📘 Manual: Menambahkan User Database PostgreSQL

Dokumen ini menjelaskan cara menambahkan user baru untuk mengakses database `manufacturing_db` di PostgreSQL.

## 📋 Informasi User Baru

- **Nama User**: IT FOOM
- **Username PostgreSQL**: `it_foom` (PostgreSQL tidak mendukung spasi dalam username)
- **Password**: `FOOMIT`
- **Database**: `manufacturing_db`
- **Port**: `5433` ⚠️ **PENTING**: Database ini menggunakan port 5433, bukan port default 5432!

---

## ⚡ Quick Fix untuk Connection Error

Jika Anda mendapatkan error **"connection was aborted by the software in your host machine"**, jalankan script fix berikut:

```bash
cd ~/deployments/manufacturing-app/server
chmod +x fix-postgresql-connection.sh
./fix-postgresql-connection.sh
```

Script ini akan:
1. ✅ Cek status PostgreSQL
2. ✅ Verifikasi port listening
3. ✅ Fix konfigurasi pg_hba.conf
4. ✅ Update password dengan encryption yang benar
5. ✅ Grant semua privileges
6. ✅ Test koneksi

**Atau gunakan perintah manual cepat:**

```bash
# 1. Update password user
sudo -u postgres psql -c "ALTER USER it_foom WITH PASSWORD 'FOOMIT';"

# 2. Fix pg_hba.conf (tambahkan baris jika belum ada)
PG_HBA_FILE=$(sudo -u postgres psql -t -P format=unaligned -c 'SHOW hba_file;' | xargs)
echo "host    all             all             127.0.0.1/32            scram-sha-256" | sudo tee -a "$PG_HBA_FILE"

# 3. Reload PostgreSQL
sudo systemctl reload postgresql

# 4. Test koneksi
PGPASSWORD=FOOMIT psql -h localhost -p 5433 -U it_foom -d manufacturing_db -c "SELECT 1;"
```

---

## 🚀 Metode 1: Menggunakan psql (Command Line)

### Langkah 1: Akses PostgreSQL sebagai Superuser

```bash
# SSH ke VPS (jika database di VPS)
ssh foom@ProductionDashboard
# atau
ssh foom@103.31.39.189

# Masuk ke PostgreSQL sebagai user postgres
sudo -u postgres psql
```

### Langkah 2: Buat User Baru

Setelah masuk ke psql prompt, jalankan perintah berikut:

```sql
-- Buat user baru dengan password
CREATE USER it_foom WITH PASSWORD 'FOOMIT';

-- Berikan hak akses ke database manufacturing_db
GRANT ALL PRIVILEGES ON DATABASE manufacturing_db TO it_foom;

-- Connect ke database manufacturing_db
\c manufacturing_db

-- Berikan hak akses ke schema public
GRANT ALL ON SCHEMA public TO it_foom;

-- Berikan hak akses ke semua tabel yang ada
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO it_foom;

-- Berikan hak akses ke semua sequences (untuk AUTO_INCREMENT)
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO it_foom;

-- Berikan hak akses default untuk tabel dan sequences yang akan dibuat di masa depan
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO it_foom;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO it_foom;

-- Keluar dari psql
\q
```

### Langkah 3: Verifikasi User

```bash
# Test koneksi dengan user baru (menggunakan port 5433)
PGPASSWORD=FOOMIT psql -h localhost -p 5433 -U it_foom -d manufacturing_db -c "SELECT current_user, current_database();"
```

Jika berhasil, Anda akan melihat output:
```
 current_user | current_database 
--------------+------------------
 it_foom      | manufacturing_db
```

---

## 🛠️ Metode 2: Menggunakan Script Bash (Otomatis)

Buat file script untuk otomatisasi:

### Script: `server/add-database-user.sh`

```bash
#!/bin/bash

# Script untuk menambahkan user database PostgreSQL
# Usage: ./add-database-user.sh

set -e

echo "🔧 Menambahkan User Database PostgreSQL"
echo "========================================"
echo ""

# Konfigurasi
DB_NAME="manufacturing_db"
NEW_USER="it_foom"
NEW_PASSWORD="FOOMIT"

echo "📋 Informasi User:"
echo "   Username: $NEW_USER"
echo "   Database: $DB_NAME"
echo ""

# Check PostgreSQL status
echo "🔍 Step 1: Checking PostgreSQL status..."
sudo systemctl status postgresql --no-pager | head -3 || {
    echo "   ⚠️  PostgreSQL not running, starting..."
    sudo systemctl start postgresql
}

# Check if user already exists
echo "🔍 Step 2: Checking if user exists..."
USER_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$NEW_USER'")

if [ "$USER_EXISTS" = "1" ]; then
    echo "   ⚠️  User '$NEW_USER' already exists"
    read -p "   Do you want to update password? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "   🔄 Updating password..."
        sudo -u postgres psql -c "ALTER USER $NEW_USER WITH PASSWORD '$NEW_PASSWORD';"
        echo "   ✅ Password updated"
    else
        echo "   ℹ️  Skipping password update"
    fi
else
    echo "   🔄 Creating new user..."
    sudo -u postgres psql -c "CREATE USER $NEW_USER WITH PASSWORD '$NEW_PASSWORD';"
    echo "   ✅ User created"
fi

# Grant privileges
echo "🔍 Step 3: Granting privileges..."
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $NEW_USER;" || true
sudo -u postgres psql -d $DB_NAME -c "GRANT ALL ON SCHEMA public TO $NEW_USER;" || true
sudo -u postgres psql -d $DB_NAME -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO $NEW_USER;" || true
sudo -u postgres psql -d $DB_NAME -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO $NEW_USER;" || true
sudo -u postgres psql -d $DB_NAME -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO $NEW_USER;" || true
sudo -u postgres psql -d $DB_NAME -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO $NEW_USER;" || true
echo "   ✅ Privileges granted"

# Reload PostgreSQL
echo "🔄 Step 4: Reloading PostgreSQL..."
sudo systemctl reload postgresql || sudo systemctl restart postgresql
echo "   ✅ PostgreSQL reloaded"

# Test connection
echo "🔍 Step 5: Testing connection..."
PGPASSWORD=$NEW_PASSWORD psql -h localhost -U $NEW_USER -d $DB_NAME -c "SELECT current_user, current_database();" > /dev/null 2>&1 && {
    echo "   ✅ Connection test successful!"
    echo ""
    echo "📊 User Information:"
    PGPASSWORD=$NEW_PASSWORD psql -h localhost -U $NEW_USER -d $DB_NAME -c "SELECT current_user, current_database();"
} || {
    echo "   ⚠️  Connection test failed. Trying with Unix socket..."
    sudo -u postgres psql -d $DB_NAME -c "SET ROLE $NEW_USER; SELECT current_user, current_database();" && {
        echo "   ✅ Connection works with Unix socket"
        echo "   💡 Tip: Use DB_HOST=/var/run/postgresql in .env file"
    } || {
        echo "   ❌ Connection test failed"
        echo "   Please check PostgreSQL logs: sudo tail -f /var/log/postgresql/postgresql-*-main.log"
    }
}

echo ""
echo "✅ Setup completed!"
echo ""
echo "📝 Connection Details:"
echo "   Host: localhost (atau /var/run/postgresql untuk Unix socket)"
echo "   Port: 5433"
echo "   Database: $DB_NAME"
echo "   Username: $NEW_USER"
echo "   Password: $NEW_PASSWORD"
```

### Cara Menggunakan Script:

```bash
# Berikan permission execute
chmod +x server/add-database-user.sh

# Jalankan script
./server/add-database-user.sh
```

---

## 🔧 Metode 3: Menggunakan SQL File

Buat file SQL untuk dijalankan:

### File: `server/add-user-it-foom.sql`

```sql
-- Script untuk menambahkan user IT FOOM ke database manufacturing_db
-- Jalankan dengan: sudo -u postgres psql -f add-user-it-foom.sql

-- Buat user baru (atau update jika sudah ada)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'it_foom') THEN
        ALTER USER it_foom WITH PASSWORD 'FOOMIT';
        RAISE NOTICE 'User it_foom already exists, password updated';
    ELSE
        CREATE USER it_foom WITH PASSWORD 'FOOMIT';
        RAISE NOTICE 'User it_foom created';
    END IF;
END
$$;

-- Berikan hak akses ke database
GRANT ALL PRIVILEGES ON DATABASE manufacturing_db TO it_foom;

-- Connect ke database dan berikan hak akses
\c manufacturing_db

-- Hak akses schema
GRANT ALL ON SCHEMA public TO it_foom;

-- Hak akses tabel yang sudah ada
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO it_foom;

-- Hak akses sequences yang sudah ada
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO it_foom;

-- Hak akses default untuk objek yang akan dibuat di masa depan
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO it_foom;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO it_foom;

-- Verifikasi
SELECT 
    'User created successfully' as status,
    'it_foom' as username,
    'manufacturing_db' as database;
```

### Cara Menggunakan SQL File:

```bash
# Jalankan SQL file
sudo -u postgres psql -f server/add-user-it-foom.sql
```

---

## ✅ Verifikasi User

Setelah user dibuat, verifikasi dengan cara berikut:

### 1. Cek User di PostgreSQL

```bash
sudo -u postgres psql -c "\du it_foom"
```

Output yang diharapkan:
```
 Role name |                         Attributes                         | Member of 
-----------+------------------------------------------------------------+-----------
 it_foom   |                                                            | {}
```

### 2. Test Koneksi dengan Password

```bash
PGPASSWORD=FOOMIT psql -h localhost -p 5433 -U it_foom -d manufacturing_db -c "SELECT current_user, current_database(), version();"
```

### 3. Test Query Data

```bash
PGPASSWORD=FOOMIT psql -h localhost -p 5433 -U it_foom -d manufacturing_db -c "SELECT COUNT(*) FROM production_liquid;"
```

### 4. Cek Privileges

```bash
sudo -u postgres psql -d manufacturing_db -c "\dp" | head -20
```

---

## 🔐 Konfigurasi untuk Aplikasi

Jika user baru ini akan digunakan oleh aplikasi, update file `.env` di folder `server/`:

```env
# Database Configuration - PostgreSQL
DB_HOST=localhost
DB_PORT=5433
DB_NAME=manufacturing_db
DB_USER=it_foom
DB_PASSWORD=FOOMIT
```

**Catatan**: Jika menggunakan Unix socket (untuk performa lebih baik), gunakan:
```env
DB_HOST=/var/run/postgresql
```

---

## 🛡️ Keamanan

### Best Practices:

1. **Gunakan Password yang Kuat**
   - Minimal 8 karakter
   - Kombinasi huruf, angka, dan karakter khusus
   - Jangan gunakan password yang sama dengan user lain

2. **Limit Privileges**
   - Jika user hanya perlu read-only access:
     ```sql
     GRANT SELECT ON ALL TABLES IN SCHEMA public TO it_foom;
     ```
   - Jika user hanya perlu akses ke tabel tertentu:
     ```sql
     GRANT SELECT, INSERT, UPDATE ON production_liquid TO it_foom;
     ```

3. **Monitor User Activity**
   ```sql
   -- Cek active connections
   SELECT usename, datname, client_addr, state 
   FROM pg_stat_activity 
   WHERE usename = 'it_foom';
   ```

4. **Backup Database Sebelum Perubahan**
   ```bash
   pg_dump -h localhost -p 5433 -U admin -d manufacturing_db > backup_before_user_add.sql
   ```

---

## 🆘 Troubleshooting

### Issue 1: "connection was aborted by the software in your host machine"

Error ini biasanya terjadi karena masalah konfigurasi authentication di PostgreSQL. Berikut langkah-langkah untuk memperbaikinya:

**Diagnosis:**
```bash
# 1. Cek apakah PostgreSQL listening di port 5433
sudo netstat -tlnp | grep 5433
# atau
sudo ss -tlnp | grep 5433

# 2. Cek PostgreSQL logs untuk error detail
sudo tail -50 /var/log/postgresql/postgresql-*-main.log | grep -i "it_foom\|authentication\|connection"

# 3. Cek pg_hba.conf
sudo -u postgres psql -c "SHOW hba_file;"
PG_HBA_FILE=$(sudo -u postgres psql -t -P format=unaligned -c 'SHOW hba_file;' | xargs)
sudo cat $PG_HBA_FILE | grep -E "^[^#]"
```

**Solusi:**

1. **Pastikan pg_hba.conf mengizinkan koneksi dari localhost:**
```bash
# Cek lokasi file
PG_HBA_FILE=$(sudo -u postgres psql -t -P format=unaligned -c 'SHOW hba_file;' | xargs)
echo "File location: $PG_HBA_FILE"

# Backup file
sudo cp $PG_HBA_FILE ${PG_HBA_FILE}.backup

# Edit file (pastikan ada baris untuk localhost dengan md5 atau scram-sha-256)
sudo nano $PG_HBA_FILE
```

Pastikan ada baris seperti ini:
```
# IPv4 local connections:
host    all             all             127.0.0.1/32            scram-sha-256
# atau
host    all             all             127.0.0.1/32            md5
```

2. **Cek password encryption method:**
```bash
# Cek encryption method yang digunakan
sudo -u postgres psql -c "SHOW password_encryption;"

# Jika menggunakan scram-sha-256, pastikan user password sudah di-update
sudo -u postgres psql -c "ALTER USER it_foom WITH PASSWORD 'FOOMIT';"
```

3. **Reload PostgreSQL setelah perubahan:**
```bash
sudo systemctl reload postgresql
# atau jika reload tidak cukup
sudo systemctl restart postgresql
```

4. **Test dengan Unix socket (bypass network):**
```bash
# Test dengan Unix socket - ini akan bypass network issues
sudo -u postgres psql -d manufacturing_db -c "SET ROLE it_foom; SELECT current_user, current_database();"
```

5. **Cek firewall (jika ada):**
```bash
# Cek iptables
sudo iptables -L -n | grep 5433

# Cek ufw (jika aktif)
sudo ufw status | grep 5433
```

6. **Test dengan psql langsung:**
```bash
# Test dengan verbose untuk melihat error detail
PGPASSWORD=FOOMIT psql -h localhost -p 5433 -U it_foom -d manufacturing_db -v ON_ERROR_STOP=1 -c "SELECT 1;"
```

**Alternatif: Gunakan Unix Socket (Recommended untuk localhost)**

Jika masalah persist, gunakan Unix socket yang lebih reliable:
```bash
# Test dengan Unix socket
sudo -u postgres psql -d manufacturing_db -c "SET ROLE it_foom; SELECT current_user, current_database();"
```

Jika berhasil, update `.env` untuk menggunakan Unix socket:
```env
DB_HOST=/var/run/postgresql
# atau kosongkan DB_HOST
```

### Issue 2: "password authentication failed"

**Solusi:**
```bash
# Cek pg_hba.conf
sudo -u postgres psql -c "SHOW hba_file;"

# Edit file tersebut dan pastikan ada baris:
# local   all             all                                     md5
# host    all             all             127.0.0.1/32            md5

# Reload PostgreSQL
sudo systemctl reload postgresql
```

### Issue 2: "permission denied for table [table_name]"

**Solusi:**
Error ini terjadi karena user sudah dibuat **setelah** tabel dibuat. Perlu memberikan privileges ke tabel yang sudah ada:

```sql
-- Connect sebagai postgres ke database
sudo -u postgres psql -d manufacturing_db

-- Berikan hak akses ke semua tabel yang sudah ada
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO it_foom;

-- Berikan hak akses ke semua sequences yang sudah ada
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO it_foom;

-- Set default privileges untuk tabel/sequences baru di masa depan
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO it_foom;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO it_foom;
```

**Verifikasi privileges:**
```bash
sudo -u postgres psql -d manufacturing_db -c "\dp" | grep it_foom
```

Anda harus melihat `it_foom=arwdDxt/admin` untuk setiap tabel.

**Catatan Penting:** 
- `GRANT ALL PRIVILEGES ON ALL TABLES` hanya memberikan hak akses ke tabel yang **sudah ada** saat perintah dijalankan
- `ALTER DEFAULT PRIVILEGES` memberikan hak akses ke tabel/sequences yang **akan dibuat** di masa depan
- Jika ada tabel baru yang dibuat sebelum user dibuat, perlu jalankan GRANT lagi

### Issue 3: "permission denied for schema public"

**Solusi:**
```sql
-- Connect sebagai postgres
sudo -u postgres psql -d manufacturing_db

-- Berikan hak akses
GRANT ALL ON SCHEMA public TO it_foom;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO it_foom;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO it_foom;
```

### Issue 4: "role does not exist"

**Solusi:**
```sql
-- Pastikan user sudah dibuat
sudo -u postgres psql -c "\du it_foom"

-- Jika tidak ada, buat ulang:
CREATE USER it_foom WITH PASSWORD 'FOOMIT';
```

### Issue 5: "database does not exist"

**Solusi:**
```bash
# Cek database
sudo -u postgres psql -c "\l" | grep manufacturing_db

# Jika tidak ada, buat database:
sudo -u postgres psql -c "CREATE DATABASE manufacturing_db OWNER admin;"
```

---

## 📝 Daftar Perintah Cepat

```bash
# Buat user baru
sudo -u postgres psql -c "CREATE USER it_foom WITH PASSWORD 'FOOMIT';"

# Berikan hak akses
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE manufacturing_db TO it_foom;"
sudo -u postgres psql -d manufacturing_db -c "GRANT ALL ON SCHEMA public TO it_foom;"
sudo -u postgres psql -d manufacturing_db -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO it_foom;"

# Test koneksi
PGPASSWORD=FOOMIT psql -h localhost -p 5433 -U it_foom -d manufacturing_db -c "SELECT 1;"

# Hapus user (jika perlu)
sudo -u postgres psql -c "DROP USER IF EXISTS it_foom;"

# Update password
sudo -u postgres psql -c "ALTER USER it_foom WITH PASSWORD 'FOOMIT';"

# Cek user privileges
sudo -u postgres psql -d manufacturing_db -c "\du it_foom"
```

---

## 📚 Referensi

- [PostgreSQL CREATE USER Documentation](https://www.postgresql.org/docs/current/sql-createuser.html)
- [PostgreSQL GRANT Documentation](https://www.postgresql.org/docs/current/sql-grant.html)
- [PostgreSQL Authentication Methods](https://www.postgresql.org/docs/current/auth-methods.html)

---

## ✅ Checklist

Setelah menambahkan user, pastikan:

- [ ] User berhasil dibuat
- [ ] Password sudah diset dengan benar
- [ ] Hak akses ke database sudah diberikan
- [ ] Hak akses ke schema public sudah diberikan
- [ ] Hak akses ke semua tabel sudah diberikan
- [ ] Hak akses ke sequences sudah diberikan
- [ ] Default privileges sudah diset
- [ ] Test koneksi berhasil
- [ ] Test query data berhasil
- [ ] File `.env` sudah diupdate (jika digunakan oleh aplikasi)

---

**Dibuat**: $(date)
**Database**: manufacturing_db
**User**: it_foom (IT FOOM)
**Password**: FOOMIT
