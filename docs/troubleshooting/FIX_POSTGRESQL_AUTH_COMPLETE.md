# 🔧 Complete Fix: PostgreSQL Authentication

## 🎯 Masalah

Password sudah di-update tapi masih gagal authentication:
```
psql: error: connection to server at "localhost" (127.0.0.1), port 5432 failed: 
FATAL: password authentication failed for user "admin"
```

## 🔍 Diagnosa

Kemungkinan penyebab:
1. **pg_hba.conf** tidak mengizinkan password authentication untuk localhost
2. PostgreSQL perlu reload/restart setelah change password
3. Authentication method di pg_hba.conf salah

## ⚡ Solusi Lengkap

### Step 1: Fix Password dan Reload

```bash
cd ~/deployments/manufacturing-app/server

# Fix password
sudo -u postgres psql -c "ALTER USER admin WITH PASSWORD 'Admin123';"

# Reload PostgreSQL (tanpa restart)
sudo systemctl reload postgresql
```

### Step 2: Cek pg_hba.conf

```bash
# Cari lokasi pg_hba.conf
PG_HBA_FILE=$(sudo -u postgres psql -t -P format=unaligned -c 'SHOW hba_file;' | xargs)
echo $PG_HBA_FILE

# Lihat isinya
sudo cat $PG_HBA_FILE | grep -E "^local|^host.*127.0.0.1"
```

Pastikan ada entry seperti:
```
local   all             all                                     md5
host    all             all             127.0.0.1/32            md5
```

### Step 3: Fix pg_hba.conf (Jika Perlu)

```bash
PG_HBA_FILE=$(sudo -u postgres psql -t -P format=unaligned -c 'SHOW hba_file;' | xargs)

# Backup dulu
sudo cp $PG_HBA_FILE ${PG_HBA_FILE}.backup

# Edit (gunakan nano atau vi)
sudo nano $PG_HBA_FILE
```

Pastikan ada:
```
# TYPE  DATABASE        USER            ADDRESS                 METHOD
local   all             all                                     md5
host    all             all             127.0.0.1/32            md5
host    all             all             ::1/128                 md5
```

Setelah edit, reload:
```bash
sudo systemctl reload postgresql
```

### Step 4: Test Connection

```bash
# Test dengan PGPASSWORD
PGPASSWORD=Admin123 psql -h localhost -U admin -d manufacturing_db -c "SELECT 1;"

# Atau test via Unix socket (peer auth)
sudo -u postgres psql -d manufacturing_db -c "SET ROLE admin; SELECT 1;"
```

### Step 5: Gunakan Script Lengkap

```bash
cd ~/deployments/manufacturing-app/server

# Copy script dari git repo
cp /var/www/manufacturing-process-production-authenticity/server/fix-postgresql-complete.sh ./
cp /var/www/manufacturing-process-production-authenticity/server/test-postgresql-auth.sh ./

# Run fix
sudo bash fix-postgresql-complete.sh

# Test
bash test-postgresql-auth.sh
```

## 🔄 Alternatif: Gunakan Peer Authentication

Jika password authentication masih bermasalah, bisa gunakan peer authentication (via Unix socket):

```bash
# Test connection via postgres user dengan role switch
sudo -u postgres psql -d manufacturing_db << 'SQL'
    SET ROLE admin;
    SELECT current_user, current_database();
SQL
```

Atau update aplikasi untuk connect via Unix socket tanpa password (jika di localhost).

## 📋 Checklist

- [ ] Password sudah di-update: `ALTER USER admin WITH PASSWORD 'Admin123';`
- [ ] PostgreSQL sudah reload: `sudo systemctl reload postgresql`
- [ ] pg_hba.conf sudah benar (md5 untuk localhost)
- [ ] Test connection berhasil
- [ ] .env file sudah benar

## 🆘 Jika Masih Gagal

### Option 1: Restart PostgreSQL

```bash
sudo systemctl restart postgresql
```

### Option 2: Recreate User

```bash
# Drop dan recreate user
sudo -u postgres psql << 'PSQL'
    DROP USER IF EXISTS admin;
    CREATE USER admin WITH PASSWORD 'Admin123';
    GRANT ALL PRIVILEGES ON DATABASE manufacturing_db TO admin;
    \c manufacturing_db
    GRANT ALL ON SCHEMA public TO admin;
PSQL
```

### Option 3: Check PostgreSQL Logs

```bash
# Cek error logs
sudo tail -f /var/log/postgresql/postgresql-*-main.log

# Atau
sudo journalctl -u postgresql -f
```

### Option 4: Test dengan psql langsung

```bash
# Test sebagai postgres user dulu
sudo -u postgres psql -d manufacturing_db

# Di dalam psql:
\c manufacturing_db admin
SELECT 1;
```

## 🎯 Quick Fix Command

```bash
# Fix password
sudo -u postgres psql -c "ALTER USER admin WITH PASSWORD 'Admin123';"

# Reload
sudo systemctl reload postgresql

# Test
PGPASSWORD=Admin123 psql -h localhost -U admin -d manufacturing_db -c "SELECT 1;"
```

Jika masih gagal, cek pg_hba.conf dan pastikan menggunakan md5 authentication.

---

**Last Updated**: 2026-01-08
