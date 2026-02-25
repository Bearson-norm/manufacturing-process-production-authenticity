# 🔧 Complete Fix: PostgreSQL Authentication (Debug Version)

## 🎯 Masalah

Password authentication masih gagal meskipun sudah:
- ✅ Set password encryption ke md5
- ✅ Update pg_hba.conf ke md5
- ✅ Recreate user
- ✅ Restart PostgreSQL

## ⚡ Solusi: Debug Lengkap

### Gunakan Script Debug

```bash
cd ~/deployments/manufacturing-app/server

# Copy script dari git repo
cp /var/www/manufacturing-process-production-authenticity/server/debug-postgresql-auth.sh ./

# Run debug dan fix
sudo bash debug-postgresql-auth.sh
```

## 🔍 Manual Debug Steps

### Step 1: Verifikasi Password Encryption

```bash
# Cek current setting
sudo -u postgres psql -c "SHOW password_encryption;"

# Jika bukan md5, set ke md5
sudo -u postgres psql -c "ALTER SYSTEM SET password_encryption = 'md5';"
```

### Step 2: Verifikasi pg_hba.conf

```bash
PG_HBA_FILE=$(sudo -u postgres psql -t -P format=unaligned -c 'SHOW hba_file;' | xargs)
echo "pg_hba.conf: $PG_HBA_FILE"

# Lihat isinya
sudo cat $PG_HBA_FILE | grep -E '^local|^host.*127.0.0.1'

# Pastikan menggunakan md5
sudo cat $PG_HBA_FILE | grep -E '^local.*all.*all.*md5|^host.*all.*all.*127.0.0.1.*md5'
```

Jika tidak ada md5, update:
```bash
# Backup
sudo cp $PG_HBA_FILE ${PG_HBA_FILE}.backup

# Update (ubah semua scram-sha-256 dan peer ke md5 untuk localhost)
sudo sed -i 's/scram-sha-256/md5/g' $PG_HBA_FILE
sudo sed -i 's/^local.*all.*all.*peer/local   all             all                                     md5/g' $PG_HBA_FILE
```

### Step 3: Verifikasi User dan Password Hash

```bash
# Cek user exists
sudo -u postgres psql -c "\du admin"

# Cek password hash format (harus mulai dengan md5)
sudo -u postgres psql -tAc "SELECT substring(passwd, 1, 10) FROM pg_shadow WHERE usename = 'admin';"
```

Jika hash tidak mulai dengan `md5`, password belum di-hash dengan md5.

### Step 4: Force Recreate dengan MD5

```bash
# Pastikan password_encryption = md5
sudo -u postgres psql -c "ALTER SYSTEM SET password_encryption = 'md5';"

# Restart untuk apply setting
sudo systemctl restart postgresql
sleep 2

# Recreate user (sekarang akan menggunakan md5)
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
PSQL

# Verifikasi password hash
sudo -u postgres psql -tAc "SELECT substring(passwd, 1, 10) FROM pg_shadow WHERE usename = 'admin';"
# Harus return: md5xxxxx...
```

### Step 5: Restart PostgreSQL

```bash
sudo systemctl restart postgresql
sleep 3
```

### Step 6: Test Connection

```bash
PGPASSWORD=Admin123 psql -h localhost -U admin -d manufacturing_db -c "SELECT 1;"
```

## 🔍 Check PostgreSQL Logs

Jika masih gagal, cek logs:

```bash
# Real-time logs
sudo tail -f /var/log/postgresql/postgresql-*-main.log

# Atau
sudo journalctl -u postgresql -f
```

Cari error terkait authentication.

## 🔄 Alternatif: Gunakan Unix Socket

Jika TCP/IP masih bermasalah, gunakan Unix socket:

### Update .env

```bash
cd ~/deployments/manufacturing-app/server
nano .env
```

Ubah:
```
DB_HOST=
```

Kosongkan `DB_HOST` akan menggunakan Unix socket dengan peer authentication.

### Update config.js (jika perlu)

```javascript
database: {
  host: process.env.DB_HOST || '', // Empty = Unix socket
  // ... rest
}
```

### Test Unix Socket

```bash
sudo -u postgres psql -d manufacturing_db -c "SET ROLE admin; SELECT current_user;"
```

## 📋 Checklist Debug

- [ ] Password encryption = md5 (`SHOW password_encryption;`)
- [ ] pg_hba.conf menggunakan md5 untuk localhost
- [ ] User admin exists
- [ ] Password hash format = md5xxxxx... (bukan scram)
- [ ] PostgreSQL di-restart (bukan hanya reload)
- [ ] Test connection berhasil
- [ ] Cek logs jika masih gagal

## 🎯 Quick All-in-One Fix

```bash
# Set md5
sudo -u postgres psql -c "ALTER SYSTEM SET password_encryption = 'md5';"

# Update pg_hba.conf
PG_HBA_FILE=$(sudo -u postgres psql -t -P format=unaligned -c 'SHOW hba_file;' | xargs)
sudo sed -i 's/scram-sha-256/md5/g' $PG_HBA_FILE
sudo sed -i 's/^local.*all.*all.*peer/local   all             all                                     md5/g' $PG_HBA_FILE

# Restart
sudo systemctl restart postgresql
sleep 3

# Recreate user
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
PSQL

# Verify hash
sudo -u postgres psql -tAc "SELECT substring(passwd, 1, 10) FROM pg_shadow WHERE usename = 'admin';"

# Test
PGPASSWORD=Admin123 psql -h localhost -U admin -d manufacturing_db -c "SELECT 1;"
```

---

**Last Updated**: 2026-01-08
