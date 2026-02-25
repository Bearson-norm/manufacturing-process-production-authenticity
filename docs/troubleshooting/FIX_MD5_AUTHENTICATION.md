# 🔧 Fix: Ubah ke MD5 Authentication

## 🎯 Masalah

Password authentication masih gagal dengan `scram-sha-256`. Solusi: ubah ke `md5`.

## ⚡ Solusi Lengkap

### Step 1: Set Password Encryption ke MD5

```bash
sudo -u postgres psql << 'PSQL'
    ALTER SYSTEM SET password_encryption = 'md5';
PSQL
```

### Step 2: Update pg_hba.conf

```bash
# Cari lokasi pg_hba.conf
PG_HBA_FILE=$(sudo -u postgres psql -t -P format=unaligned -c 'SHOW hba_file;' | xargs)
echo "pg_hba.conf: $PG_HBA_FILE"

# Backup dulu
sudo cp $PG_HBA_FILE ${PG_HBA_FILE}.backup

# Ubah scram-sha-256 ke md5
sudo sed -i 's/scram-sha-256/md5/g' $PG_HBA_FILE

# Verifikasi
sudo cat $PG_HBA_FILE | grep -E '^local|^host.*127.0.0.1'
```

### Step 3: Recreate User dengan MD5 Password

```bash
sudo -u postgres psql << 'PSQL'
    -- Reassign ownership
    \c manufacturing_db
    REASSIGN OWNED BY admin TO postgres;
    DROP OWNED BY admin;
    
    -- Change database owner
    \c postgres
    ALTER DATABASE manufacturing_db OWNER TO postgres;
    
    -- Drop user
    DROP USER IF EXISTS admin;
    
    -- Create fresh user (akan menggunakan md5)
    CREATE USER admin WITH PASSWORD 'Admin123';
    
    -- Grant privileges
    GRANT ALL PRIVILEGES ON DATABASE manufacturing_db TO admin;
    ALTER DATABASE manufacturing_db OWNER TO admin;
    
    -- Grant schema privileges
    \c manufacturing_db
    GRANT ALL ON SCHEMA public TO admin;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO admin;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO admin;
PSQL
```

### Step 4: Reload/Restart PostgreSQL

```bash
# Reload dulu
sudo systemctl reload postgresql

# Jika masih gagal, restart
sudo systemctl restart postgresql
```

### Step 5: Test Connection

```bash
PGPASSWORD=Admin123 psql -h localhost -U admin -d manufacturing_db -c "SELECT 1;"
```

## 🔄 Complete Script

```bash
cd ~/deployments/manufacturing-app/server

# Copy script dari git repo
cp /var/www/manufacturing-process-production-authenticity/server/fix-postgresql-md5.sh ./

# Run fix
sudo bash fix-postgresql-md5.sh
```

## 📋 Manual Steps (All-in-One)

```bash
# 1. Set password encryption
sudo -u postgres psql -c "ALTER SYSTEM SET password_encryption = 'md5';"

# 2. Update pg_hba.conf
PG_HBA_FILE=$(sudo -u postgres psql -t -P format=unaligned -c 'SHOW hba_file;' | xargs)
sudo cp $PG_HBA_FILE ${PG_HBA_FILE}.backup
sudo sed -i 's/scram-sha-256/md5/g' $PG_HBA_FILE

# 3. Recreate user
sudo -u postgres psql << 'PSQL'
    \c manufacturing_db
    REASSIGN OWNED BY admin TO postgres;
    DROP OWNED BY admin;
    \c postgres
    ALTER DATABASE manufacturing_db OWNER TO postgres;
    DROP USER IF EXISTS admin;
    CREATE USER admin WITH PASSWORD 'Admin123';
    GRANT ALL PRIVILEGES ON DATABASE manufacturing_db TO admin;
    ALTER DATABASE manufacturing_db OWNER TO admin;
    \c manufacturing_db
    GRANT ALL ON SCHEMA public TO admin;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO admin;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO admin;
PSQL

# 4. Restart PostgreSQL
sudo systemctl restart postgresql

# 5. Test
PGPASSWORD=Admin123 psql -h localhost -U admin -d manufacturing_db -c "SELECT 1;"
```

## 🔍 Verifikasi

```bash
# Cek password encryption
sudo -u postgres psql -c "SHOW password_encryption;"
# Harus return: md5

# Cek pg_hba.conf
PG_HBA_FILE=$(sudo -u postgres psql -t -P format=unaligned -c 'SHOW hba_file;' | xargs)
sudo cat $PG_HBA_FILE | grep -E '^local|^host.*127.0.0.1'
# Harus menunjukkan: md5 (bukan scram-sha-256)
```

## ✅ Checklist

- [ ] Password encryption di-set ke md5
- [ ] pg_hba.conf di-update (scram-sha-256 → md5)
- [ ] User admin di-recreate dengan md5 password
- [ ] PostgreSQL di-restart (bukan hanya reload)
- [ ] Test connection berhasil

## 🆘 Jika Masih Gagal

### Cek PostgreSQL Logs

```bash
sudo tail -f /var/log/postgresql/postgresql-*-main.log
```

### Cek pg_hba.conf Manual

```bash
PG_HBA_FILE=$(sudo -u postgres psql -t -P format=unaligned -c 'SHOW hba_file;' | xargs)
sudo nano $PG_HBA_FILE
```

Pastikan ada:
```
local   all             all                                     md5
host    all             all             127.0.0.1/32            md5
```

### Force Restart

```bash
sudo systemctl stop postgresql
sudo systemctl start postgresql
```

---

**Last Updated**: 2026-01-08
